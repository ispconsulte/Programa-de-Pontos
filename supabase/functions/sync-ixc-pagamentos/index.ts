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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_PAGE_SIZE = 50
const MAX_PAGES = 5
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
  return (
    normalizeIsoDate(receivable.pagamento_data) ??
    normalizeIsoDate(receivable.baixa_data) ??
    normalizeIsoDate(receivable.ultima_atualizacao)
  )
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

function calculatePoints(paymentDateIso: string, dueDateIso: string): number {
  const paymentDate = normalizeDateOnly(paymentDateIso)
  const dueDate = normalizeDateOnly(dueDateIso)
  if (!paymentDate || !dueDate) return 0

  const paymentMs = Date.parse(`${paymentDate}T00:00:00.000Z`)
  const dueMs = Date.parse(`${dueDate}T00:00:00.000Z`)
  const diffDays = Math.floor((dueMs - paymentMs) / 86_400_000)

  if (diffDays >= 3) return 5
  if (diffDays >= 0) return 4
  return 2
}

function describePoints(points: number, paymentDateIso: string, dueDateIso: string): string {
  const paymentDate = normalizeDateOnly(paymentDateIso) ?? paymentDateIso
  const dueDate = normalizeDateOnly(dueDateIso) ?? dueDateIso
  return `Pagamento IXC pontuado com ${points} pontos (${paymentDate} / vencimento ${dueDate})`
}

function inRequestedRange(paymentDateIso: string | null, dateFromIso: string | null, dateToIso: string | null): boolean {
  if (!paymentDateIso) return false
  const paymentMs = Date.parse(paymentDateIso)
  if (Number.isNaN(paymentMs)) return false

  if (dateFromIso) {
    const fromMs = Date.parse(dateFromIso)
    if (!Number.isNaN(fromMs) && paymentMs < fromMs) return false
  }

  if (dateToIso) {
    const toMs = Date.parse(dateToIso)
    if (!Number.isNaN(toMs) && paymentMs > toMs) return false
  }

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
    throw new Error(`IXC list failed for ${endpoint}: ${response.status} | user=${connection.ixc_user} | token_preview=${token.substring(0,6)}...${token.substring(token.length-4)} | token_len=${token.length} | url=${url} | response=${body.substring(0,200)}`)
  }

  const json = await response.json()
  console.log(`[DEBUG] IXC ${endpoint} raw response: ${JSON.stringify(json).substring(0, 500)}`)
  if (json.type === 'error' || (json.type && !json.registros && !json.msg)) {
    throw new Error(`IXC API error for ${endpoint}: ${json.message ?? JSON.stringify(json)}`)
  }
  return json
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
  existingStatus?: string | null,
) {
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
    status: existingStatus ?? normalizeCustomerCampaignStatus(customer.ativo),
    ultima_sincronizacao_em: new Date().toISOString(),
    metadata,
  }

  const { data, error } = await supabase
    .from('pontuacao_campanha_clientes')
    .upsert(row, { onConflict: 'tenant_id,ixc_cliente_id' })
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
    .eq('fatura_id', receivable.id)
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
    ixc_cliente_id: receivable.id_cliente,
    ixc_contrato_id: resolveContractId(receivable),
    fatura_id: receivable.id,
    competencia: normalizeDateOnly(receivable.data_vencimento),
    data_pagamento: paymentDateIso,
    valor_pago: Number.parseFloat(normalizeText(receivable.valor_recebido) ?? '0'),
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
    .eq('fatura_id', receivableId)
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
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(body.pageSize ?? 20)))
    const maxPages = Math.min(MAX_PAGES, Math.max(1, Number(body.maxPages ?? 1)))
    const dateFromIso = parseRequestDateBoundary(body.dateFrom, 'start')
    const dateToIso = parseRequestDateBoundary(body.dateTo, 'end')
    const dryRun = Boolean(body.dryRun)

    const connection = await loadIxcConnection(supabase, user.tenant_id, body.ixcConnectionId)
    const ixcToken = await decryptIxcToken(connection.ixc_token_enc, connection.ixc_token_iv)
    console.log(`[DEBUG] IXC user: ${connection.ixc_user}, token preview: ${ixcToken.substring(0, 8)}...${ixcToken.substring(ixcToken.length - 4)}, token length: ${ixcToken.length}, base_url: ${connection.ixc_base_url}`)
    console.log(`[DEBUG] Auth header: Basic ${btoa(`${connection.ixc_user}:${ixcToken}`).substring(0, 20)}...`)

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
          maxPages,
          dateFrom: dateFromIso,
          dateTo: dateToIso,
          dryRun,
          ixcConnectionId: connection.id,
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
    for (let pageOffset = 0; pageOffset < maxPages; pageOffset += 1) {
      const currentPage = page + pageOffset
      const response = await fetchIxcList<FnAreceberItem>(connection, ixcToken, 'fn_areceber', {
        qtype: 'id_carteira_cobranca',
        query: '1',
        oper: '>=',
        page: String(currentPage),
        rp: String(pageSize),
        sortname: 'fn_areceber.id',
        sortorder: 'desc',
      })

      const rows = response.msg ?? response.registros ?? []
      if (rows.length === 0) break
      pageResults.push(...rows)
      if (rows.length < pageSize) break
    }

    counters.fetched = pageResults.length

    const eligibleReceivables = pageResults.filter((receivable) => {
      if (getPaymentCategory(receivable) !== 'received') return false
      return inRequestedRange(getPaymentDate(receivable), dateFromIso, dateToIso)
    })

    counters.eligible = eligibleReceivables.length

    const details: Array<Record<string, Json>> = []

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
        const customer = await fetchIxcRecord<ClienteItem>(connection, ixcToken, 'cliente', receivable.id_cliente)
        const existingCustomer = await loadExistingCampaignCustomer(supabase, user.tenant_id, customer.id)

        if (dryRun) {
          const existingInvoiceStatus = await loadExistingInvoiceStatus(supabase, user.tenant_id, receivable.id)
          if (existingInvoiceStatus === 'processado' || existingInvoiceStatus === 'ignorado') {
            counters.skipped += 1
            details.push({
              receivableId: receivable.id,
              customerId: customer.id,
              status: 'already_processed',
            })
            continue
          }

          const campaignStatus = existingCustomer?.status ?? normalizeCustomerCampaignStatus(customer.ativo)
          if (campaignStatus !== 'ativo') {
            counters.ignored += 1
            details.push({
              receivableId: receivable.id,
              customerId: customer.id,
              status: 'ignored',
              reason: 'status_campanha_inativo',
            })
            continue
          }

          const points = calculatePoints(paymentDateIso, dueDateIso)
          if (points <= 0) {
            counters.ignored += 1
            details.push({
              receivableId: receivable.id,
              customerId: customer.id,
              status: 'ignored',
              reason: 'sem_regra_de_pontuacao',
            })
            continue
          }

          counters.processed += 1
          counters.pointsGranted += points
          details.push({
            receivableId: receivable.id,
            customerId: customer.id,
            status: 'dry_run',
            points,
          })
          continue
        }

        const campaignCustomer = await upsertCampaignCustomer(
          supabase,
          user.tenant_id,
          customer,
          resolveContractId(receivable),
          paymentDateIso,
          existingCustomer?.status ?? null,
        )

        const processingHash = await sha256([
          user.tenant_id,
          connection.id,
          receivable.id,
          customer.id,
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
            customerId: customer.id,
            status: lock.action === 'locked' ? 'locked' : 'already_processed',
          })
          continue
        }

        if (campaignCustomer.status !== 'ativo') {
          counters.ignored += 1

          if (!dryRun) {
            await finalizeProcessedInvoice(supabase, lock.rowId, {
              campanha_cliente_id: campaignCustomer.id,
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
            customerId: customer.id,
            status: 'ignored',
            reason: 'status_campanha_inativo',
          })
          continue
        }

        const points = calculatePoints(paymentDateIso, dueDateIso)
        if (points <= 0) {
          counters.ignored += 1

          if (!dryRun) {
            await finalizeProcessedInvoice(supabase, lock.rowId, {
              campanha_cliente_id: campaignCustomer.id,
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
            customerId: customer.id,
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
              tenant_id: user.tenant_id,
              campanha_cliente_id: campaignCustomer.id,
              tipo_movimentacao: 'credito',
              origem: HISTORY_ORIGIN,
              descricao: describePoints(points, paymentDateIso, dueDateIso),
              pontos_movimentados: points,
              saldo_apos: nextAccumulatedPoints - redeemedPoints,
              referencia_externa: receivable.id,
              payload: {
                ixcConnectionId: connection.id,
                ixcClienteId: customer.id,
                ixcContratoId: resolveContractId(receivable),
                faturaId: receivable.id,
                valorPago: normalizeText(receivable.valor_recebido),
                dueDateIso,
                paymentDateIso,
              },
            })

          if (historyError) throw new Error(historyError.message)

          const { error: customerUpdateError } = await supabase
            .from('pontuacao_campanha_clientes')
            .update({
              ixc_contrato_id: resolveContractId(receivable),
              nome_cliente: resolveCustomerName(customer),
              documento: normalizeText(customer.cnpj_cpf),
              email: resolveCustomerEmail(customer),
              telefone: resolveCustomerPhone(customer),
              pontos_acumulados: nextAccumulatedPoints,
              ultima_sincronizacao_em: new Date().toISOString(),
              metadata: {
                origem: 'ixc',
                ultima_fatura_processada: receivable.id,
                ultima_data_pagamento_ixc: paymentDateIso,
                ultima_atualizacao_ixc: normalizeIsoDate(customer.ultima_atualizacao),
              },
            })
            .eq('id', campaignCustomer.id)

          if (customerUpdateError) throw new Error(customerUpdateError.message)

          await finalizeProcessedInvoice(supabase, lock.rowId, {
            campanha_cliente_id: campaignCustomer.id,
            pontos_gerados: points,
            status_processamento: 'processado',
            payload: {
              processing: false,
              paymentDateIso,
              dueDateIso,
              regra: points === 5 ? 'antecipado_3_ou_mais' : points === 4 ? 'em_dia' : 'apos_vencimento',
            },
          })
        }

        counters.processed += 1
        counters.pointsGranted += points
        details.push({
          receivableId: receivable.id,
          customerId: customer.id,
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
      maxPages,
      dateFrom: dateFromIso,
      dateTo: dateToIso,
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
