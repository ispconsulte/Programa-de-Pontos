// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
type AnySupabase = SupabaseClient<any, any, any>

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

interface SyncRequest {
  tenantId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
  maxPages?: number
  ixcConnectionId?: string
  dryRun?: boolean
}

interface UserRow {
  id: string | null
  tenant_id: string
  role: string
}

interface IxcConnectionRow {
  id: string
  tenant_id: string
  name: string | null
  ixc_base_url: string
  ixc_user: string
  ixc_token_enc: string | Uint8Array | number[]
  ixc_token_iv: string | Uint8Array | number[]
  active: boolean
}

interface FnAreceberItem {
  id: string
  status: string
  filial_id: string
  id_cliente: string
  id_contrato: string
  id_contrato_avulso: string
  id_contrato_principal: string
  data_emissao: string
  data_vencimento: string
  valor: string
  valor_recebido: string
  valor_aberto: string
  valor_juros: string
  valor_multas: string
  valor_cancelado: string
  pagamento_data: string
  baixa_data: string
  tipo_recebimento: string
  forma_recebimento?: string
  recebido_via_pix: string
  titulo_renegociado: string
  documento: string
  nn_boleto: string
  id_carteira_cobranca: string
  obs: string
  liberado: string
  previsao: string
  nparcela: string
  ultima_atualizacao: string
}

interface ClienteItem {
  id: string
  razao: string
  fantasia: string
  cnpj_cpf: string
  tipo_pessoa: string
  ativo: string
  email: string
  hotsite_email: string
  telefone_celular: string
  fone: string
  endereco: string
  numero: string
  complemento: string
  bairro: string
  cep: string
  cidade: string
  uf: string
  filial_id: string
  data_nascimento: string
  data_cadastro: string
  ultima_atualizacao: string
}

interface CampaignCustomerSummaryRow {
  id: string
  status: 'ativo' | 'inativo' | 'bloqueado'
  pontos_acumulados: number
  pontos_resgatados: number
}

function toStoredCampaignStatus(status: string | null | undefined): 'ativo' | 'suspenso' | 'bloqueado' | 'encerrado' {
  const normalized = normalizeText(status)?.toLowerCase()
  if (normalized === 'ativo') return 'ativo'
  if (normalized === 'bloqueado') return 'bloqueado'
  if (normalized === 'encerrado') return 'encerrado'
  return 'suspenso'
}

interface IxcListResponse<T> {
  msg?: T[]
  registros?: T[]
  total?: string | number
  page?: string
}

interface SyncCounters {
  fetched: number
  eligible: number
  processed: number
  ignored: number
  skipped: number
  errors: number
  pointsGranted: number
}

interface CampaignScoringRules {
  campaignId: string | null
  campaignName: string
  thresholdEarlyDays: number
  pointsEarly: number
  pointsOnDue: number
  pointsLate: number
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 100
const PROCESSING_LOCK_MINUTES = 15
const SYNC_TYPE = 'sync_ixc_pagamentos'
const HISTORY_ORIGIN = 'sync_ixc_pagamentos'

function json(status: number, body: Json) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (!text) return null
  if (text === '-' || text === '0') return null
  if (text === '0000-00-00' || text === '0000-00-00 00:00:00') return null
  if (text.toLowerCase() === 'undefined' || text.toLowerCase() === 'null') return null
  return text
}

function normalizeDateOnly(value?: string | null): string | null {
  const normalized = normalizeText(value)
  if (!normalized) return null
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

function normalizeIsoDate(value?: string | null): string | null {
  const normalized = normalizeText(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()

  const dateOnly = normalizeDateOnly(normalized)
  if (!dateOnly) return null

  const fallback = new Date(`${dateOnly}T00:00:00.000Z`)
  return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString()
}

function parseRequestDateBoundary(value: string | undefined, boundary: 'start' | 'end'): string | null {
  if (!value) return null
  const dateOnly = normalizeDateOnly(value)
  if (!dateOnly) return null
  return boundary === 'start'
    ? `${dateOnly}T00:00:00.000Z`
    : `${dateOnly}T23:59:59.999Z`
}

function getPaymentDate(receivable: FnAreceberItem): string | null {
  // Business rule: consider only payment date for window filtering.
  return normalizeIsoDate(receivable.pagamento_data)
}

function getDueDate(receivable: FnAreceberItem): string | null {
  return normalizeIsoDate(receivable.data_vencimento)
}

function isActualPayment(receivable: FnAreceberItem): boolean {
  if (receivable.status !== 'R') return false
  const amount = Number.parseFloat(normalizeText(receivable.valor_recebido) ?? '0')
  return Number.isFinite(amount) && amount > 0
}

function getPaymentCategory(receivable: FnAreceberItem): 'received' | 'renegotiated' | 'open' | 'cancelled' {
  if (receivable.status === 'C') return 'cancelled'
  if (receivable.status === 'A') return 'open'
  if (receivable.status === 'R') return isActualPayment(receivable) ? 'received' : 'renegotiated'
  return 'open'
}

function resolveContractId(receivable: FnAreceberItem): string | null {
  return (
    normalizeText(receivable.id_contrato) ??
    normalizeText(receivable.id_contrato_avulso) ??
    normalizeText(receivable.id_contrato_principal)
  )
}

function resolveCustomerName(customer: ClienteItem): string {
  return (
    normalizeText(customer.razao) ??
    normalizeText(customer.fantasia) ??
    `Cliente IXC ${customer.id}`
  )
}

function resolveCustomerEmail(customer: ClienteItem): string | null {
  return normalizeText(customer.email) ?? normalizeText(customer.hotsite_email)
}

function resolveCustomerPhone(customer: ClienteItem): string | null {
  return normalizeText(customer.telefone_celular) ?? normalizeText(customer.fone)
}

function normalizeCustomerCampaignStatus(customerActive?: string | null): 'ativo' | 'inativo' {
  const normalized = normalizeText(customerActive)?.toLowerCase()
  if (!normalized) return 'ativo'
  if (['s', 'sim', 'a', 'ativo', '1', 'true'].includes(normalized)) return 'ativo'
  return 'inativo'
}

function getDaysDiff(paymentDateIso: string, dueDateIso: string): number | null {
  const paymentDate = normalizeDateOnly(paymentDateIso)
  const dueDate = normalizeDateOnly(dueDateIso)
  if (!paymentDate || !dueDate) return null

  const paymentMs = Date.parse(`${paymentDate}T00:00:00.000Z`)
  const dueMs = Date.parse(`${dueDate}T00:00:00.000Z`)
  return Math.floor((dueMs - paymentMs) / 86_400_000)
}

function resolveScoringRule(paymentDateIso: string, dueDateIso: string, rules: CampaignScoringRules): 'antecipado' | 'no_vencimento' | 'apos_vencimento' {
  const diffDays = getDaysDiff(paymentDateIso, dueDateIso)
  if (diffDays === null) return 'no_vencimento'
  if (diffDays >= rules.thresholdEarlyDays) return 'antecipado'
  if (diffDays >= 0) return 'no_vencimento'
  return 'apos_vencimento'
}

function calculatePoints(paymentDateIso: string, dueDateIso: string, rules: CampaignScoringRules): number {
  const rule = resolveScoringRule(paymentDateIso, dueDateIso, rules)
  if (rule === 'antecipado') return rules.pointsEarly
  if (rule === 'no_vencimento') return rules.pointsOnDue
  return rules.pointsLate
}

function resolveTipoEvento(paymentDateIso: string, dueDateIso: string): string {
  const diffDays = getDaysDiff(paymentDateIso, dueDateIso)
  if (diffDays === null) return 'pagamento_no_dia'

  if (diffDays >= 3) return 'pagamento_antecipado'
  if (diffDays >= 0) return 'pagamento_no_dia'
  return 'pagamento_em_atraso'
}

function describePoints(points: number, paymentDateIso: string, dueDateIso: string): string {
  const paymentDate = normalizeDateOnly(paymentDateIso) ?? paymentDateIso
  const dueDate = normalizeDateOnly(dueDateIso) ?? dueDateIso
  return `Pagamento IXC pontuado com ${points} pontos (${paymentDate} / vencimento ${dueDate})`
}

async function loadCampaignScoringRules(
  supabase: AnySupabase,
  tenantId: string,
): Promise<CampaignScoringRules> {
  const fallback: CampaignScoringRules = {
    campaignId: null,
    campaignName: 'Regra padrão',
    thresholdEarlyDays: 3,
    pointsEarly: 5,
    pointsOnDue: 4,
    pointsLate: 2,
  }

  const { data: activeCampaign, error: campaignError } = await supabase
    .from('pontuacao_campanhas')
    .select('id, nome')
    .eq('tenant_id', tenantId)
    .eq('ativa', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (campaignError) throw new Error(campaignError.message)
  if (!activeCampaign?.id) return fallback

  const { data: ruleRows, error: rulesError } = await supabase
    .from('pontuacao_campanha_regras')
    .select('regra_codigo, dias_antecedencia_min, pontos, ativo')
    .eq('tenant_id', tenantId)
    .eq('campanha_id', activeCampaign.id)
    .eq('ativo', true)

  if (rulesError) throw new Error(rulesError.message)

  const rulesByCode = new Map<string, { dias: number | null; pontos: number }>()
  for (const row of ruleRows ?? []) {
    const code = normalizeText(row.regra_codigo)
    if (!code) continue
    const points = Number(row.pontos)
    if (!Number.isFinite(points)) continue
    let days: number | null = null
    if (row.dias_antecedencia_min !== null && row.dias_antecedencia_min !== undefined) {
      const parsedDays = Number(row.dias_antecedencia_min)
      days = Number.isFinite(parsedDays) ? parsedDays : null
    }
    rulesByCode.set(code, { dias: days, pontos: points })
  }

  return {
    campaignId: String(activeCampaign.id),
    campaignName: normalizeText(activeCampaign.nome) ?? fallback.campaignName,
    thresholdEarlyDays: rulesByCode.get('antecipado')?.dias ?? fallback.thresholdEarlyDays,
    pointsEarly: rulesByCode.get('antecipado')?.pontos ?? fallback.pointsEarly,
    pointsOnDue: rulesByCode.get('no_vencimento')?.pontos ?? fallback.pointsOnDue,
    pointsLate: rulesByCode.get('apos_vencimento')?.pontos ?? fallback.pointsLate,
  }
}

function inRequestedRange(paymentDateIso: string | null, dateFromIso: string | null, dateToIso: string | null): boolean {
  const paymentDate = normalizeDateOnly(paymentDateIso)
  if (!paymentDate) return false

  const fromDate = normalizeDateOnly(dateFromIso)
  if (fromDate && paymentDate < fromDate) return false

  const toDate = normalizeDateOnly(dateToIso)
  if (toDate && paymentDate > toDate) return false

  return true
}

function parseBytea(value: string | Uint8Array | number[]): Uint8Array {
  if (value instanceof Uint8Array) return value
  if (Array.isArray(value)) return Uint8Array.from(value)

  const text = String(value)
  if (text.startsWith('\\x')) {
    const hex = text.slice(2)
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16)
    }
    return bytes
  }

  try {
    const binary = atob(text)
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    const cleanHex = text.replace(/[^0-9a-f]/gi, '')
    if (cleanHex.length % 2 !== 0) {
      throw new Error('Invalid encrypted IXC token format')
    }
    const bytes = new Uint8Array(cleanHex.length / 2)
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = Number.parseInt(cleanHex.slice(i, i + 2), 16)
    }
    return bytes
  }
}

async function decryptIxcToken(encValue: string | Uint8Array | number[], ivValue: string | Uint8Array | number[]): Promise<string> {
  const encryptionKey = getEnv('ENCRYPTION_KEY')
  const rawKey = Uint8Array.from(encryptionKey.match(/.{1,2}/g)!.map((pair) => Number.parseInt(pair, 16)))
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt'])
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: parseBytea(ivValue) as unknown as BufferSource },
    key,
    parseBytea(encValue) as unknown as BufferSource,
  )

  return new TextDecoder().decode(decrypted)
}

async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function fetchIxcList<T>(
  connection: IxcConnectionRow,
  token: string,
  endpoint: string,
  payload: Record<string, string>,
): Promise<IxcListResponse<T>> {
  const baseUrl = connection.ixc_base_url.replace(/\/$/, '')
  const authString = `${connection.ixc_user}:${token}`
  const authB64 = btoa(authString)
  const url = `${baseUrl}/webservice/v1/${endpoint}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authB64}`,
      ixcsoft: 'listar',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`IXC list failed for ${endpoint}: ${response.status} | user=${connection.ixc_user} | url=${url} | response=${body.substring(0,200)}`)
  }

  const json = await response.json()
  console.log(`[DEBUG] IXC ${endpoint} raw response: ${JSON.stringify(json).substring(0, 500)}`)
  if (json.type === 'error' || (json.type && !json.registros && !json.msg)) {
    throw new Error(`IXC API error for ${endpoint}: ${json.message ?? JSON.stringify(json)}`)
  }
  return json
}

async function fetchReceivablesPage(
  connection: IxcConnectionRow,
  ixcToken: string,
  currentPage: number,
  pageSize: number,
  dateFromIso: string | null,
): Promise<IxcListResponse<FnAreceberItem>> {
  const fromDate = normalizeDateOnly(dateFromIso)
  const basePayload = {
    qtype: fromDate ? 'fn_areceber.pagamento_data' : 'fn_areceber.status',
    query: fromDate ?? 'R',
    oper: fromDate ? '>=' : '=',
    page: String(currentPage),
    rp: String(pageSize),
    sortorder: 'desc',
  }

  try {
    // Use stable ordering by ID to avoid pagination duplicates/skips.
    return await fetchIxcList<FnAreceberItem>(connection, ixcToken, 'fn_areceber', {
      ...basePayload,
      sortname: fromDate ? 'fn_areceber.pagamento_data' : 'fn_areceber.id',
    })
  } catch (error) {
    console.warn(`[WARN] fallback to pagamento_data ordering on page ${currentPage}: ${(error as Error).message}`)
    return await fetchIxcList<FnAreceberItem>(connection, ixcToken, 'fn_areceber', {
      ...basePayload,
      sortname: 'fn_areceber.pagamento_data',
    })
  }
}

async function fetchIxcRecord<T>(
  connection: IxcConnectionRow,
  token: string,
  endpoint: string,
  id: string,
): Promise<T> {
  const baseUrl = connection.ixc_base_url.replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/webservice/v1/${endpoint}/${id}`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${btoa(`${connection.ixc_user}:${token}`)}`,
      ixcsoft: 'listar',
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`IXC get failed for ${endpoint}/${id}: ${response.status}`)
  }

  return await response.json()
}

async function fetchIxcCustomerById(
  connection: IxcConnectionRow,
  token: string,
  customerId: string,
): Promise<ClienteItem> {
  const response = await fetchIxcList<ClienteItem>(connection, token, 'cliente', {
    qtype: 'cliente.id',
    query: customerId,
    oper: '=',
    page: '1',
    rp: '1',
    sortname: 'cliente.id',
    sortorder: 'asc',
  })

  const rows = response.msg ?? response.registros ?? []
  const customer = rows[0]

  if (!customer?.id) {
    throw new Error(`IXC customer not found for id ${customerId}`)
  }

  return customer
}

async function hasMirroredCustomer(
  supabase: AnySupabase,
  tenantId: string,
  customerId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('ixc_clientes')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('ixc_cliente_id', customerId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return Boolean(data?.id)
}

async function upsertMirroredCustomer(
  supabase: AnySupabase,
  tenantId: string,
  customer: ClienteItem,
) {
  const row = {
    tenant_id: tenantId,
    ixc_cliente_id: customer.id,
    nome: resolveCustomerName(customer),
    documento: normalizeText(customer.cnpj_cpf),
    email: resolveCustomerEmail(customer),
    telefone: resolveCustomerPhone(customer),
    ativo: normalizeText(customer.ativo),
    ultima_atualizacao_ixc: normalizeIsoDate(customer.ultima_atualizacao),
    payload_raw: customer as unknown as Json,
  }

  const { error } = await supabase
    .from('ixc_clientes')
    .upsert(row, { onConflict: 'tenant_id,ixc_cliente_id' })

  if (error) throw new Error(error.message)
}

async function getAuthenticatedUser(supabase: AnySupabase, request: Request, parsedBody: SyncRequest): Promise<UserRow> {
  // Support cron secret
  const cronSecret = request.headers.get('x-cron-secret')
  const expectedCronSecret = Deno.env.get('CRON_SHARED_SECRET')
  if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
    if (!parsedBody.tenantId) {
      throw new Error('tenantId is required for scheduled sync')
    }
    return { id: null, tenant_id: parsedBody.tenantId, role: 'system' }
  }

  // Allow system invocation via body.tenantId (for cron, admin tools, testing)
  if (parsedBody.tenantId) {
    return { id: null, tenant_id: parsedBody.tenantId, role: 'system' }
  }

  const authHeader = request.headers.get('Authorization')
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''
  if (!jwt) throw new Error('Authorization header is required')


  const { data: authData, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !authData.user) {
    throw new Error(authError?.message ?? 'Unauthorized')
  }

  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (userError) throw new Error(userError.message)
  if (!userRow) throw new Error('User not found')
  if (!['admin', 'owner', 'manager'].includes(userRow.role)) {
    throw new Error('Forbidden')
  }

  return userRow as UserRow
}

async function loadIxcConnection(
  supabase: AnySupabase,
  tenantId: string,
  requestedConnectionId?: string,
): Promise<IxcConnectionRow> {
  let query = supabase
    .from('ixc_connections')
    .select('id, tenant_id, name, ixc_base_url, ixc_user, ixc_token_enc, ixc_token_iv, active')
    .eq('tenant_id', tenantId)

  if (requestedConnectionId) {
    query = query.eq('id', requestedConnectionId)
  } else {
    query = query.order('active', { ascending: false }).order('created_at', { ascending: true })
  }

  const { data, error } = await query.limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('IXC integration not configured')

  return data as IxcConnectionRow
}

async function upsertCampaignCustomer(
  supabase: AnySupabase,
  tenantId: string,
  customer: ClienteItem,
  contractId: string | null,
  paymentDateIso: string | null,
  existingCustomer?: CampaignCustomerSummaryRow | null,
) {
  const derivedStatus = existingCustomer?.status ?? normalizeCustomerCampaignStatus(customer.ativo)
  const metadata = {
    origem: 'ixc',
    filial_id: normalizeText(customer.filial_id),
    ultima_data_pagamento_ixc: paymentDateIso,
    ultima_atualizacao_ixc: normalizeIsoDate(customer.ultima_atualizacao),
  }

  const row = {
    tenant_id: tenantId,
    ixc_cliente_id: customer.id,
    ixc_contrato_id: contractId,
    nome_cliente: resolveCustomerName(customer),
    documento: normalizeText(customer.cnpj_cpf),
    email: resolveCustomerEmail(customer),
    telefone: resolveCustomerPhone(customer),
    status: derivedStatus,
    status_campanha: toStoredCampaignStatus(derivedStatus),
    ultima_sincronizacao_em: new Date().toISOString(),
    metadata,
  }

  if (existingCustomer?.id) {
    const { data, error } = await supabase
      .from('pontuacao_campanha_clientes')
      .update(row)
      .eq('id', existingCustomer.id)
      .select('id, tenant_id, ixc_cliente_id, status, pontos_acumulados, pontos_resgatados')
      .single()

    if (error) throw new Error(error.message)
    return data
  }

  const { data, error } = await supabase
    .from('pontuacao_campanha_clientes')
    .insert({
      ...row,
      pontos_acumulados: 0,
      pontos_resgatados: 0,
    })
    .select('id, tenant_id, ixc_cliente_id, status, pontos_acumulados, pontos_resgatados')
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function acquireInvoiceLock(
  supabase: AnySupabase,
  tenantId: string,
  syncLogId: string,
  campaignCustomerId: string | null,
  receivable: FnAreceberItem,
  paymentDateIso: string | null,
  hash: string,
) {
  const { data: existing, error: existingError } = await supabase
    .from('pontuacao_faturas_processadas')
    .select('id, status_processamento, payload, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .or(`ixc_fatura_id.eq.${receivable.id},fatura_id.eq.${receivable.id}`)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)

  if (existing && ['processado', 'ignorado'].includes(existing.status_processamento)) {
    return { action: 'skip' as const, rowId: existing.id }
  }

  const processingStartedAt = existing?.payload?.processing_started_at
  if (existing?.status_processamento === 'erro' && existing?.payload?.processing === true && processingStartedAt) {
    const lockAgeMs = Date.now() - Date.parse(String(processingStartedAt))
    if (!Number.isNaN(lockAgeMs) && lockAgeMs < PROCESSING_LOCK_MINUTES * 60_000) {
      return { action: 'locked' as const, rowId: existing.id }
    }
  }

  const payload = {
    ...((existing?.payload as Record<string, Json> | null) ?? {}),
    processing: true,
    processing_started_at: new Date().toISOString(),
    ultimo_sync_log_id: syncLogId,
    categoria_ixc: getPaymentCategory(receivable),
  }

  const baseRow = {
    tenant_id: tenantId,
    campanha_cliente_id: campaignCustomerId,
    sync_log_id: syncLogId,
    ixc_fatura_id: receivable.id,
    ixc_cliente_id: receivable.id_cliente,
    ixc_contrato_id: resolveContractId(receivable),
    fatura_id: receivable.id,
    competencia: normalizeDateOnly(receivable.data_vencimento),
    data_pagamento: paymentDateIso,
    valor_pago: Number.parseFloat(normalizeText(receivable.valor_recebido) ?? '0'),
    pontos_atribuidos: 0,
    pontos_gerados: 0,
    status_processamento: 'erro',
    hash_processamento: hash,
    payload,
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('pontuacao_faturas_processadas')
      .update(baseRow)
      .eq('id', existing.id)

    if (updateError) throw new Error(updateError.message)
    return { action: 'process' as const, rowId: existing.id }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('pontuacao_faturas_processadas')
    .insert(baseRow)
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') return { action: 'skip' as const, rowId: null }
    throw new Error(insertError.message)
  }

  return { action: 'process' as const, rowId: inserted.id as string }
}

async function finalizeProcessedInvoice(
  supabase: AnySupabase,
  rowId: string,
  updates: Record<string, Json>,
) {
  const { error } = await supabase
    .from('pontuacao_faturas_processadas')
    .update(updates)
    .eq('id', rowId)

  if (error) throw new Error(error.message)
}

async function loadExistingCampaignCustomer(
  supabase: AnySupabase,
  tenantId: string,
  customerId: string,
): Promise<CampaignCustomerSummaryRow | null> {
  const { data, error } = await supabase
    .from('pontuacao_campanha_clientes')
    .select('id, status, pontos_acumulados, pontos_resgatados')
    .eq('tenant_id', tenantId)
    .eq('ixc_cliente_id', customerId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as CampaignCustomerSummaryRow | null) ?? null
}

async function loadExistingInvoiceStatus(
  supabase: AnySupabase,
  tenantId: string,
  receivableId: string,
): Promise<'processado' | 'ignorado' | 'erro' | null> {
  const { data, error } = await supabase
    .from('pontuacao_faturas_processadas')
    .select('status_processamento')
    .eq('tenant_id', tenantId)
    .or(`ixc_fatura_id.eq.${receivableId},fatura_id.eq.${receivableId}`)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return typeof data?.status_processamento === 'string'
    ? data.status_processamento as 'processado' | 'ignorado' | 'erro'
    : null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const supabase: AnySupabase = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'))

  let syncLogId: string | null = null

  try {
    const body = (await request.json().catch(() => ({}))) as SyncRequest
    const user = await getAuthenticatedUser(supabase, request, body)
    const page = Math.max(1, Number(body.page ?? 1))
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(body.pageSize ?? DEFAULT_PAGE_SIZE)))
    const dateFromIso = parseRequestDateBoundary(body.dateFrom, 'start')
    const dateToIso = parseRequestDateBoundary(body.dateTo, 'end')
    const dryRun = Boolean(body.dryRun)

    const connection = await loadIxcConnection(supabase, user.tenant_id, body.ixcConnectionId)
    const ixcToken = await decryptIxcToken(connection.ixc_token_enc, connection.ixc_token_iv)
    const scoringRules = await loadCampaignScoringRules(supabase, user.tenant_id)
    console.log(`[DEBUG] IXC connection loaded for user ${connection.ixc_user} at ${connection.ixc_base_url}`)

    const { data: syncLog, error: syncLogError } = await supabase
      .from('pontuacao_sync_log')
      .insert({
        tenant_id: user.tenant_id,
        tipo_sync: SYNC_TYPE,
        status: 'processando',
        referencia: connection.id,
        mensagem: 'Sincronizacao iniciada',
        payload: {
          page,
          pageSize,
          maxPages: null,
          dateFrom: dateFromIso,
          dateTo: dateToIso,
          dryRun,
          ixcConnectionId: connection.id,
          campaignId: scoringRules.campaignId,
          campaignName: scoringRules.campaignName,
          scoringRules: {
            thresholdEarlyDays: scoringRules.thresholdEarlyDays,
            pointsEarly: scoringRules.pointsEarly,
            pointsOnDue: scoringRules.pointsOnDue,
            pointsLate: scoringRules.pointsLate,
          },
          execution_id: Deno.env.get('SB_EXECUTION_ID') ?? null,
        },
      })
      .select('id')
      .single()

    if (syncLogError) throw new Error(syncLogError.message)
    syncLogId = String(syncLog.id)

    const counters: SyncCounters = {
      fetched: 0,
      eligible: 0,
      processed: 0,
      ignored: 0,
      skipped: 0,
      errors: 0,
      pointsGranted: 0,
    }

    const pageResults: FnAreceberItem[] = []
    const seenPageFingerprints = new Set<string>()
    let ixcTotalRows: number | null = null
    for (let currentPage = page; ; currentPage += 1) {
      const response = await fetchReceivablesPage(connection, ixcToken, currentPage, pageSize, dateFromIso)

      const rows = response.msg ?? response.registros ?? []
      if (rows.length === 0) break

      if (ixcTotalRows === null && response.total !== undefined && response.total !== null) {
        const parsedTotal = Number(response.total)
        if (Number.isFinite(parsedTotal) && parsedTotal >= 0) {
          ixcTotalRows = parsedTotal
        }
      }

      const fingerprint = rows.map((row) => String(row.id)).join('|')
      if (seenPageFingerprints.has(fingerprint)) {
        console.warn(`[WARN] repeated page fingerprint detected at page ${currentPage}; stopping pagination to avoid infinite loop`)
        break
      }
      seenPageFingerprints.add(fingerprint)

      pageResults.push(...rows)

      if (ixcTotalRows !== null) {
        const fetchedByPagination = (currentPage - page + 1) * pageSize
        if (fetchedByPagination >= ixcTotalRows) break
      }

      if (rows.length < pageSize) break
    }

    counters.fetched = pageResults.length

    const eligibleReceivables = pageResults.filter((receivable) => {
      if (getPaymentCategory(receivable) !== 'received') return false
      return inRequestedRange(getPaymentDate(receivable), dateFromIso, dateToIso)
    })

    counters.eligible = eligibleReceivables.length

    const details: Array<Record<string, Json>> = []
    const campaignCustomerCache = new Map<string, CampaignCustomerSummaryRow | null>()
    const ixcMirrorPresenceCache = new Map<string, boolean>()
    const fetchedCustomerCache = new Map<string, ClienteItem>()

    for (const receivable of eligibleReceivables) {
      const paymentDateIso = getPaymentDate(receivable)
      const dueDateIso = getDueDate(receivable)

      if (!paymentDateIso || !dueDateIso) {
        counters.skipped += 1
        details.push({
          receivableId: receivable.id,
          status: 'skipped',
          reason: 'missing_dates',
        })
        continue
      }

      try {
        const customerId = normalizeText(receivable.id_cliente) ?? ''
        if (!customerId) {
          counters.skipped += 1
          details.push({
            receivableId: receivable.id,
            status: 'skipped',
            reason: 'missing_customer_id',
          })
          continue
        }

        let existingCustomer = campaignCustomerCache.get(customerId)
        if (existingCustomer === undefined) {
          existingCustomer = await loadExistingCampaignCustomer(supabase, user.tenant_id, customerId)
          campaignCustomerCache.set(customerId, existingCustomer)
        }

        let hasIxcMirror = ixcMirrorPresenceCache.get(customerId)
        if (hasIxcMirror === undefined) {
          hasIxcMirror = await hasMirroredCustomer(supabase, user.tenant_id, customerId)
          ixcMirrorPresenceCache.set(customerId, hasIxcMirror)
        }

        let customer: ClienteItem | null = null

        // Fetch IXC customer at most once per customer in this execution.
        // Required when customer is missing in local mirror or campaign customer table.
        if (!existingCustomer || !hasIxcMirror) {
          customer = fetchedCustomerCache.get(customerId) ?? null
          if (!customer) {
            customer = await fetchIxcCustomerById(connection, ixcToken, customerId)
            fetchedCustomerCache.set(customerId, customer)
          }
        }

        if (!dryRun && customer && !hasIxcMirror) {
          await upsertMirroredCustomer(supabase, user.tenant_id, customer)
          hasIxcMirror = true
          ixcMirrorPresenceCache.set(customerId, true)
        }

        if (dryRun) {
          const existingInvoiceStatus = await loadExistingInvoiceStatus(supabase, user.tenant_id, receivable.id)
          if (existingInvoiceStatus === 'processado' || existingInvoiceStatus === 'ignorado') {
            counters.skipped += 1
            details.push({
              receivableId: receivable.id,
              customerId,
              status: 'already_processed',
            })
            continue
          }

          const campaignStatus = existingCustomer?.status ?? normalizeCustomerCampaignStatus(customer?.ativo)
          if (campaignStatus !== 'ativo') {
            counters.ignored += 1
            details.push({
              receivableId: receivable.id,
              customerId,
              status: 'ignored',
              reason: 'status_campanha_inativo',
            })
            continue
          }

          const points = calculatePoints(paymentDateIso, dueDateIso, scoringRules)
          if (points <= 0) {
            counters.ignored += 1
            details.push({
              receivableId: receivable.id,
              customerId,
              status: 'ignored',
              reason: 'sem_regra_de_pontuacao',
            })
            continue
          }

          counters.processed += 1
          counters.pointsGranted += points
          details.push({
            receivableId: receivable.id,
            customerId,
            status: 'dry_run',
            points,
          })
          continue
        }

        const campaignCustomer = existingCustomer
          ? existingCustomer
          : await upsertCampaignCustomer(
            supabase,
            user.tenant_id,
            customer!,
            resolveContractId(receivable),
            paymentDateIso,
            null,
          )
        campaignCustomerCache.set(customerId, campaignCustomer as CampaignCustomerSummaryRow)

        const processingHash = await sha256([
          user.tenant_id,
          connection.id,
          receivable.id,
          customerId,
          paymentDateIso,
          dueDateIso,
          normalizeText(receivable.valor_recebido) ?? '0',
        ].join(':'))

        const lock = await acquireInvoiceLock(
          supabase,
          user.tenant_id,
          syncLogId,
          campaignCustomer.id,
          receivable,
          paymentDateIso,
          processingHash,
        )

        if (lock.action === 'skip' || lock.action === 'locked') {
          counters.skipped += 1
          details.push({
            receivableId: receivable.id,
            customerId,
            status: lock.action === 'locked' ? 'locked' : 'already_processed',
          })
          continue
        }

        if (campaignCustomer.status !== 'ativo') {
          counters.ignored += 1

          if (!dryRun) {
            await finalizeProcessedInvoice(supabase, lock.rowId, {
              campanha_cliente_id: campaignCustomer.id,
              pontos_atribuidos: 0,
              pontos_gerados: 0,
              status_processamento: 'ignorado',
              payload: {
                processing: false,
                motivo: 'status_campanha_inativo',
                status_campanha: campaignCustomer.status,
                paymentDateIso,
                dueDateIso,
              },
            })
          }

          details.push({
            receivableId: receivable.id,
            customerId,
            status: 'ignored',
            reason: 'status_campanha_inativo',
          })
          continue
        }

        const points = calculatePoints(paymentDateIso, dueDateIso, scoringRules)
        const appliedRule = resolveScoringRule(paymentDateIso, dueDateIso, scoringRules)
        if (points <= 0) {
          counters.ignored += 1

          if (!dryRun) {
            await finalizeProcessedInvoice(supabase, lock.rowId, {
              campanha_cliente_id: campaignCustomer.id,
              pontos_atribuidos: 0,
              pontos_gerados: 0,
              status_processamento: 'ignorado',
              payload: {
                processing: false,
                motivo: 'sem_regra_de_pontuacao',
                paymentDateIso,
                dueDateIso,
              },
            })
          }

          details.push({
            receivableId: receivable.id,
            customerId,
            status: 'ignored',
            reason: 'sem_regra_de_pontuacao',
          })
          continue
        }

        const accumulatedPoints = Number(campaignCustomer.pontos_acumulados ?? 0)
        const redeemedPoints = Number(campaignCustomer.pontos_resgatados ?? 0)
        const nextAccumulatedPoints = accumulatedPoints + points

        if (!dryRun) {
          const { error: historyError } = await supabase
            .from('pontuacao_historico')
            .insert({
              ixc_cliente_id: customerId,
              ixc_fatura_id: receivable.id,
              tipo_evento: resolveTipoEvento(paymentDateIso, dueDateIso),
              pontos: points,
              descricao: describePoints(points, paymentDateIso, dueDateIso),
              criado_por: 'sync_ixc_pagamentos',
              referencia_mes: paymentDateIso ? new Date(paymentDateIso).getMonth() + 1 : null,
              referencia_ano: paymentDateIso ? new Date(paymentDateIso).getFullYear() : null,
            })

          if (historyError) throw new Error(historyError.message)

          const { error: customerUpdateError } = await supabase
            .from('pontuacao_campanha_clientes')
            .update({
              ixc_contrato_id: resolveContractId(receivable),
              pontos_acumulados: nextAccumulatedPoints,
              ultima_sincronizacao_em: new Date().toISOString(),
              metadata: {
                origem: 'ixc',
                ultima_fatura_processada: receivable.id,
                ultima_data_pagamento_ixc: paymentDateIso,
                ultima_atualizacao_ixc: normalizeIsoDate(customer?.ultima_atualizacao),
              },
              ...(customer
                ? {
                  nome_cliente: resolveCustomerName(customer),
                  documento: normalizeText(customer.cnpj_cpf),
                  email: resolveCustomerEmail(customer),
                  telefone: resolveCustomerPhone(customer),
                }
                : {}),
            })
            .eq('id', campaignCustomer.id)

          if (customerUpdateError) throw new Error(customerUpdateError.message)

          await finalizeProcessedInvoice(supabase, lock.rowId, {
            campanha_cliente_id: campaignCustomer.id,
            pontos_atribuidos: points,
            pontos_gerados: points,
            status_processamento: 'processado',
            payload: {
              processing: false,
              paymentDateIso,
              dueDateIso,
              regra: appliedRule,
            },
          })
        }

        counters.processed += 1
        counters.pointsGranted += points
        details.push({
          receivableId: receivable.id,
          customerId,
          status: dryRun ? 'dry_run' : 'processed',
          points,
        })
      } catch (itemError) {
        counters.errors += 1
        details.push({
          receivableId: receivable.id,
          status: 'error',
          error: itemError instanceof Error ? itemError.message : String(itemError),
        })
      }
    }

    const finalStatus =
      counters.errors > 0 && counters.processed > 0 ? 'parcial' :
      counters.errors > 0 ? 'erro' :
      'sucesso'

    const payload = {
      page,
      pageSize,
      paginationMode: 'until_exhausted',
      sourceTotalRows: ixcTotalRows,
      dateFrom: dateFromIso,
      dateTo: dateToIso,
      campaignId: scoringRules.campaignId,
      campaignName: scoringRules.campaignName,
      scoringRules: {
        thresholdEarlyDays: scoringRules.thresholdEarlyDays,
        pointsEarly: scoringRules.pointsEarly,
        pointsOnDue: scoringRules.pointsOnDue,
        pointsLate: scoringRules.pointsLate,
      },
      dryRun,
      fetched: counters.fetched,
      eligible: counters.eligible,
      processed: counters.processed,
      ignored: counters.ignored,
      skipped: counters.skipped,
      errors: counters.errors,
      pointsGranted: counters.pointsGranted,
      details,
    }

    await supabase
      .from('pontuacao_sync_log')
      .update({
        status: finalStatus,
        mensagem: dryRun
          ? 'Sincronizacao simulada concluida'
          : `Sincronizacao concluida com ${counters.processed} faturas processadas`,
        payload,
        finalizado_em: new Date().toISOString(),
      })
      .eq('id', syncLogId)

    return json(200, payload)
  } catch (error) {
    if (syncLogId) {
      await supabase
        .from('pontuacao_sync_log')
        .update({
          status: 'erro',
          mensagem: error instanceof Error ? error.message : String(error),
          payload: {
            fatal: true,
            error: error instanceof Error ? error.message : String(error),
          },
          finalizado_em: new Date().toISOString(),
        })
        .eq('id', syncLogId)
    }

    return json(500, {
      error: error instanceof Error ? error.message : 'Unexpected error',
    })
  }
})
