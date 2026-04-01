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
  customerId?: string
  page?: number
  pageSize?: number
  maxPages?: number
  maxCustomers?: number
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

interface ClienteItem {
  id: string
  razao: string
  fantasia: string
  cnpj_cpf: string
  ativo: string
  email: string
  hotsite_email: string
  telefone_celular: string
  fone: string
  filial_id: string
  ultima_atualizacao: string
}

interface ClienteContratoItem {
  id: string
  id_cliente: string
  id_filial: string
  status: string
  status_internet: string
  contrato: string
  data_ativacao: string
  data_expiracao: string
  data_renovacao: string
  situacao_financeira_contrato: string
  pago_ate_data: string
  fidelidade: string
  taxa_instalacao: string
  desconto_fidelidade: string
  bloqueio_automatico: string
  contrato_suspenso: string
  id_vd_contrato: string
  id_tipo_contrato: string
  id_carteira_cobranca: string
  id_vendedor: string
  tipo_cobranca: string
  renovacao_automatica: string
  ultima_atualizacao: string
}

interface IxcListResponse<T> {
  msg?: T[]
  registros?: T[]
}

interface SyncCounters {
  customersFetched: number
  contractsFetched: number
  snapshotsUpdated: number
  statusUpdated: number
  upgradesDetected: number
  renewalsDetected: number
  skipped: number
  errors: number
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_PAGE_SIZE = 50
const MAX_CUSTOMERS = 1000
const MAX_PAGES = 20
const SYNC_TYPE = 'sync_ixc_contratos'

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

function normalizeIsoDate(value?: string | null): string | null {
  const normalized = normalizeText(value)
  if (!normalized) return null
  const parsed = new Date(normalized)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  return null
}

function normalizeCustomerName(customer: ClienteItem): string {
  return normalizeText(customer.razao) ?? normalizeText(customer.fantasia) ?? `Cliente IXC ${customer.id}`
}

function normalizeCustomerEmail(customer: ClienteItem): string | null {
  return normalizeText(customer.email) ?? normalizeText(customer.hotsite_email)
}

function normalizeCustomerPhone(customer: ClienteItem): string | null {
  return normalizeText(customer.telefone_celular) ?? normalizeText(customer.fone)
}

function normalizePlanName(contract: ClienteContratoItem): string | null {
  return normalizeText(contract.contrato)
}

function parseCurrency(value?: string | null): number | null {
  const normalized = normalizeText(value)
  if (!normalized) return null
  const numeric = Number.parseFloat(normalized.replace(',', '.'))
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeDateOnly(value?: string | null): string | null {
  const normalized = normalizeText(value)
  if (!normalized) return null
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

function parseLoyaltyMonths(value?: string | null): number | null {
  const normalized = normalizeText(value)
  if (!normalized) return null
  const numeric = Number.parseInt(normalized.replace(/\D/g, ''), 10)
  return Number.isFinite(numeric) ? numeric : null
}

function buildContractSnapshot(contract: ClienteContratoItem) {
  return {
    contractId: contract.id,
    customerId: contract.id_cliente,
    planName: normalizePlanName(contract),
    planValue: parseCurrency(contract.taxa_instalacao),
    status: normalizeText(contract.status),
    internetStatus: normalizeText(contract.status_internet),
    financialStatus: normalizeText(contract.situacao_financeira_contrato),
    paidUntil: normalizeDateOnly(contract.pago_ate_data),
    loyaltyMonths: parseLoyaltyMonths(contract.fidelidade),
    renewalDate: normalizeDateOnly(contract.data_renovacao),
    activationDate: normalizeDateOnly(contract.data_ativacao),
    expirationDate: normalizeDateOnly(contract.data_expiracao),
    automaticRenewal: normalizeText(contract.renovacao_automatica),
    suspended: normalizeText(contract.contrato_suspenso),
    updatedAt: normalizeIsoDate(contract.ultima_atualizacao),
  }
}

function deriveCampaignStatus(customerActive: string | null, contracts: ClienteContratoItem[]): 'ativo' | 'inativo' | 'bloqueado' {
  const activeCustomer = ['s', 'sim', '1', 'true', 'ativo', 'a'].includes((customerActive ?? '').trim().toLowerCase())
  if (!activeCustomer) return 'inativo'

  const hasBlocked = contracts.some((contract) => {
    const markers = [
      normalizeText(contract.status),
      normalizeText(contract.status_internet),
      normalizeText(contract.situacao_financeira_contrato),
      normalizeText(contract.contrato_suspenso),
    ].filter(Boolean).join(' ').toLowerCase()

    return markers.includes('bloq') || markers.includes('susp') || markers.includes('inad')
  })

  return hasBlocked ? 'bloqueado' : 'ativo'
}

function shouldRegisterUpgrade(previousSnapshot: Record<string, Json> | null, currentSnapshot: ReturnType<typeof buildContractSnapshot>): boolean {
  if (!previousSnapshot) return false
  const previousValue = typeof previousSnapshot.planValue === 'number' ? previousSnapshot.planValue : null
  const currentValue = currentSnapshot.planValue
  if (previousValue === null || currentValue === null) return false
  if (currentValue <= previousValue) return false

  const previousPlan = typeof previousSnapshot.planName === 'string' ? previousSnapshot.planName : null
  return previousPlan !== currentSnapshot.planName || currentValue > previousValue
}

function shouldRegisterRenewal(previousSnapshot: Record<string, Json> | null, currentSnapshot: ReturnType<typeof buildContractSnapshot>): boolean {
  if (!previousSnapshot) return false

  const previousRenewalDate = typeof previousSnapshot.renewalDate === 'string' ? previousSnapshot.renewalDate : null
  const currentRenewalDate = currentSnapshot.renewalDate
  if (!previousRenewalDate || !currentRenewalDate) return false

  const previousMonths = typeof previousSnapshot.loyaltyMonths === 'number' ? previousSnapshot.loyaltyMonths : null
  const currentMonths = currentSnapshot.loyaltyMonths

  return currentRenewalDate > previousRenewalDate || (previousMonths !== null && currentMonths !== null && currentMonths > previousMonths)
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

  const binary = atob(text)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
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

async function fetchIxcList<T>(
  connection: IxcConnectionRow,
  token: string,
  endpoint: string,
  payload: Record<string, string>,
): Promise<IxcListResponse<T>> {
  const baseUrl = connection.ixc_base_url.replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/webservice/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${connection.ixc_user}:${token}`)}`,
      ixcsoft: 'listar',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) throw new Error(`IXC list failed for ${endpoint}: ${response.status}`)
  return await response.json()
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

  if (!response.ok) throw new Error(`IXC get failed for ${endpoint}/${id}: ${response.status}`)
  return await response.json()
}

async function getAuthenticatedUser(supabase: AnySupabase, request: Request, parsedBody: SyncRequest): Promise<UserRow> {
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
  if (authError || !authData.user) throw new Error(authError?.message ?? 'Unauthorized')

  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (userError) throw new Error(userError.message)
  if (!userRow) throw new Error('User not found')
  if (!['admin', 'owner', 'manager'].includes(userRow.role)) throw new Error('Forbidden')

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

async function ensureCustomerProfile(
  supabase: AnySupabase,
  tenantId: string,
  connectionId: string,
  customer: ClienteItem,
  contractId: string | null,
  metadata: Record<string, Json>,
  dryRun: boolean,
) {
  const { data: existingIdentity, error: identityError } = await supabase
    .from('customer_identities')
    .select('id, customer_profile_id')
    .eq('tenant_id', tenantId)
    .eq('source_type', 'ixc')
    .eq('source_connection_id', connectionId)
    .eq('external_customer_id', customer.id)
    .maybeSingle()

  if (identityError) throw new Error(identityError.message)

  let profileId = existingIdentity?.customer_profile_id as string | undefined
  if (!profileId) {
    const reusableFilters = [
      normalizeText(customer.cnpj_cpf) ? `document_number.eq.${normalizeText(customer.cnpj_cpf)}` : null,
      normalizeCustomerEmail(customer) ? `email.eq.${normalizeCustomerEmail(customer)}` : null,
      normalizeCustomerPhone(customer) ? `phone.eq.${normalizeCustomerPhone(customer)}` : null,
    ].filter(Boolean) as string[]

    if (reusableFilters.length > 0) {
      const { data: reusableProfile, error: reusableError } = await supabase
        .from('customer_profiles')
        .select('id')
        .eq('tenant_id', tenantId)
        .or(reusableFilters.join(','))
        .limit(1)
        .maybeSingle()

      if (reusableError && reusableError.code !== 'PGRST116') throw new Error(reusableError.message)
      profileId = reusableProfile?.id as string | undefined
    }
  }

  if (!profileId) {
    if (dryRun) return { profileId: 'dry-run-profile' }

    const { data: createdProfile, error: createProfileError } = await supabase
      .from('customer_profiles')
      .insert({
        tenant_id: tenantId,
        display_name: normalizeCustomerName(customer),
        document_number: normalizeText(customer.cnpj_cpf),
        email: normalizeCustomerEmail(customer),
        phone: normalizeCustomerPhone(customer),
        metadata,
      })
      .select('id')
      .single()

    if (createProfileError) throw new Error(createProfileError.message)
    profileId = createdProfile.id as string
  } else if (!dryRun) {
    const { error: updateProfileError } = await supabase
      .from('customer_profiles')
      .update({
        display_name: normalizeCustomerName(customer),
        document_number: normalizeText(customer.cnpj_cpf),
        email: normalizeCustomerEmail(customer),
        phone: normalizeCustomerPhone(customer),
        metadata,
      })
      .eq('id', profileId)

    if (updateProfileError) throw new Error(updateProfileError.message)
  }

  if (dryRun) return { profileId }

  const { error: upsertIdentityError } = await supabase
    .from('customer_identities')
    .upsert({
      tenant_id: tenantId,
      customer_profile_id: profileId,
      source_type: 'ixc',
      source_connection_id: connectionId,
      external_customer_id: customer.id,
      external_contract_id: contractId,
      metadata,
    }, { onConflict: 'tenant_id,source_type,source_connection_id,external_customer_id' })

  if (upsertIdentityError) throw new Error(upsertIdentityError.message)
  return { profileId }
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
    const user = await getAuthenticatedUser(supabase, request)
    const page = Math.max(1, Number(body.page ?? 1))
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(body.pageSize ?? 20)))
    const maxPages = Math.min(MAX_PAGES, Math.max(1, Number(body.maxPages ?? 1)))
    const maxCustomers = Math.min(MAX_CUSTOMERS, Math.max(1, Number(body.maxCustomers ?? pageSize)))
    const dryRun = Boolean(body.dryRun)

    const connection = await loadIxcConnection(supabase, user.tenant_id, body.ixcConnectionId)
    const ixcToken = await decryptIxcToken(connection.ixc_token_enc, connection.ixc_token_iv)

    const { data: syncLog, error: syncLogError } = await supabase
      .from('pontuacao_sync_log')
      .insert({
        tenant_id: user.tenant_id,
        tipo_sync: SYNC_TYPE,
        status: 'processando',
        referencia: body.customerId ?? connection.id,
        mensagem: 'Sincronizacao de contratos iniciada',
        payload: {
          page,
          pageSize,
          maxPages,
          maxCustomers,
          customerId: body.customerId ?? null,
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
      customersFetched: 0,
      contractsFetched: 0,
      snapshotsUpdated: 0,
      statusUpdated: 0,
      upgradesDetected: 0,
      renewalsDetected: 0,
      skipped: 0,
      errors: 0,
    }

    let customers: ClienteItem[] = []
    if (body.customerId) {
      customers = [await fetchIxcRecord<ClienteItem>(connection, ixcToken, 'cliente', body.customerId)]
    } else {
      const collected: ClienteItem[] = []
      for (let pageOffset = 0; pageOffset < maxPages; pageOffset += 1) {
        const currentPage = page + pageOffset
        const response = await fetchIxcList<ClienteItem>(connection, ixcToken, 'cliente', {
          qtype: 'cliente.id',
          query: '0',
          oper: '>',
          page: String(currentPage),
          rp: String(pageSize),
          sortname: 'id',
          sortorder: 'asc',
        })

        const rows = response.msg ?? response.registros ?? []
        if (rows.length === 0) break

        collected.push(...rows)
        if (rows.length < pageSize || collected.length >= maxCustomers) break
      }

      customers = collected.slice(0, maxCustomers)
    }

    counters.customersFetched = customers.length
    const details: Array<Record<string, Json>> = []

    for (const customer of customers) {
      try {
        const contractsResponse = await fetchIxcList<ClienteContratoItem>(connection, ixcToken, 'cliente_contrato', {
          qtype: 'cliente_contrato.id_cliente',
          query: customer.id,
          oper: '=',
          page: '1',
          rp: '50',
          sortname: 'id',
          sortorder: 'asc',
        })

        const contracts = contractsResponse.msg ?? contractsResponse.registros ?? []
        counters.contractsFetched += contracts.length

        const { data: existingCampaignCustomer, error: existingCustomerError } = await supabase
          .from('pontuacao_campanha_clientes')
          .select('id, status, metadata')
          .eq('tenant_id', user.tenant_id)
          .eq('ixc_cliente_id', customer.id)
          .maybeSingle()

        if (existingCustomerError) throw new Error(existingCustomerError.message)

        const derivedStatus = deriveCampaignStatus(normalizeText(customer.ativo), contracts)
        const contractSnapshots = contracts.map(buildContractSnapshot)
        const primaryContract = contractSnapshots[0] ?? null
        const metadata = {
          origem: 'ixc',
          filial_id: normalizeText(customer.filial_id),
          contratos_snapshot: contractSnapshots,
          contratos_snapshot_updated_at: new Date().toISOString(),
          cliente_ixc_updated_at: normalizeIsoDate(customer.ultima_atualizacao),
        }

        let campaignCustomerId = existingCampaignCustomer?.id as string | undefined
        if (!campaignCustomerId) {
          if (!dryRun) {
            const { data: createdCustomer, error: createCustomerError } = await supabase
              .from('pontuacao_campanha_clientes')
              .insert({
                tenant_id: user.tenant_id,
                ixc_cliente_id: customer.id,
                ixc_contrato_id: primaryContract?.contractId ?? null,
                nome_cliente: normalizeCustomerName(customer),
                documento: normalizeText(customer.cnpj_cpf),
                email: normalizeCustomerEmail(customer),
                telefone: normalizeCustomerPhone(customer),
                status: derivedStatus,
                ultima_sincronizacao_em: new Date().toISOString(),
                metadata,
              })
              .select('id')
              .single()

            if (createCustomerError) throw new Error(createCustomerError.message)
            campaignCustomerId = createdCustomer.id as string
          }
          counters.snapshotsUpdated += 1
          counters.statusUpdated += 1
        } else if (!dryRun) {
          const { error: updateCustomerError } = await supabase
            .from('pontuacao_campanha_clientes')
            .update({
              ixc_contrato_id: primaryContract?.contractId ?? null,
              nome_cliente: normalizeCustomerName(customer),
              documento: normalizeText(customer.cnpj_cpf),
              email: normalizeCustomerEmail(customer),
              telefone: normalizeCustomerPhone(customer),
              status: derivedStatus,
              ultima_sincronizacao_em: new Date().toISOString(),
              metadata,
            })
            .eq('id', campaignCustomerId)

          if (updateCustomerError) throw new Error(updateCustomerError.message)
          counters.snapshotsUpdated += 1
          if (existingCampaignCustomer && existingCampaignCustomer.status !== derivedStatus) counters.statusUpdated += 1
        }

        const profile = await ensureCustomerProfile(
          supabase,
          user.tenant_id,
          connection.id,
          customer,
          primaryContract?.contractId ?? null,
          metadata,
          dryRun,
        )

        const previousSnapshots =
          (existingCampaignCustomer?.metadata as Record<string, Json> | null)?.contratos_snapshot as Record<string, Json>[] | undefined
        const previousByContractId = new Map<string, Record<string, Json>>(
          (previousSnapshots ?? [])
            .filter((snapshot) => typeof snapshot?.contractId === 'string')
            .map((snapshot) => [String(snapshot.contractId), snapshot]),
        )

        for (const contract of contracts) {
          const currentSnapshot = buildContractSnapshot(contract)
          const previousSnapshot = previousByContractId.get(contract.id) ?? null

          if (shouldRegisterUpgrade(previousSnapshot, currentSnapshot)) {
            const idempotencyKey = [
              'upgrade',
              connection.id,
              customer.id,
              contract.id,
              previousSnapshot?.planValue ?? 'na',
              currentSnapshot.planValue ?? 'na',
              currentSnapshot.updatedAt ?? currentSnapshot.renewalDate ?? 'sem_data',
            ].join(':')

            const { data: existingUpgrade, error: existingUpgradeError } = await supabase
              .from('campaign_events')
              .select('id')
              .eq('tenant_id', user.tenant_id)
              .eq('idempotency_key', idempotencyKey)
              .maybeSingle()

            if (existingUpgradeError) throw new Error(existingUpgradeError.message)

            if (!existingUpgrade && !dryRun) {
              const { error: insertUpgradeError } = await supabase
                .from('campaign_events')
                .insert({
                  tenant_id: user.tenant_id,
                  ixc_connection_id: connection.id,
                  customer_id: customer.id,
                  customer_profile_id: profile.profileId,
                  contract_id: contract.id,
                  event_type: 'upgrade',
                  event_source: 'ixc',
                  source_reference_type: 'cliente_contrato',
                  source_reference_id: contract.id,
                  occurred_at: currentSnapshot.updatedAt ?? new Date().toISOString(),
                  points: 5,
                  idempotency_key: idempotencyKey,
                  payload: {
                    previousSnapshot,
                    currentSnapshot,
                  },
                  created_by: user.id,
                  description: 'Upgrade elegivel detectado via sync de contrato IXC',
                  rule_code: 'upgrade_default',
                })

              if (insertUpgradeError) throw new Error(insertUpgradeError.message)
              counters.upgradesDetected += 1
            } else if (existingUpgrade) {
              counters.skipped += 1
            }
          }

          if (shouldRegisterRenewal(previousSnapshot, currentSnapshot)) {
            const idempotencyKey = [
              'loyalty_renewal',
              connection.id,
              customer.id,
              contract.id,
              previousSnapshot?.renewalDate ?? 'na',
              currentSnapshot.renewalDate ?? 'na',
            ].join(':')

            const { data: existingRenewal, error: existingRenewalError } = await supabase
              .from('campaign_events')
              .select('id')
              .eq('tenant_id', user.tenant_id)
              .eq('idempotency_key', idempotencyKey)
              .maybeSingle()

            if (existingRenewalError) throw new Error(existingRenewalError.message)

            if (!existingRenewal && !dryRun) {
              const { error: insertRenewalError } = await supabase
                .from('campaign_events')
                .insert({
                  tenant_id: user.tenant_id,
                  ixc_connection_id: connection.id,
                  customer_id: customer.id,
                  customer_profile_id: profile.profileId,
                  contract_id: contract.id,
                  event_type: 'loyalty_renewal',
                  event_source: 'ixc',
                  source_reference_type: 'cliente_contrato',
                  source_reference_id: contract.id,
                  occurred_at: currentSnapshot.renewalDate ? `${currentSnapshot.renewalDate}T00:00:00.000Z` : new Date().toISOString(),
                  points: 3,
                  idempotency_key: idempotencyKey,
                  payload: {
                    previousSnapshot,
                    currentSnapshot,
                  },
                  created_by: user.id,
                  description: 'Renovacao de fidelidade detectada via sync de contrato IXC',
                  rule_code: 'loyalty_renewal_default',
                })

              if (insertRenewalError) throw new Error(insertRenewalError.message)
              counters.renewalsDetected += 1
            } else if (existingRenewal) {
              counters.skipped += 1
            }
          }
        }

        details.push({
          customerId: customer.id,
          campaignCustomerId: campaignCustomerId ?? null,
          contracts: contracts.length,
          statusCampanha: derivedStatus,
        })
      } catch (customerError) {
        counters.errors += 1
        details.push({
          customerId: customer.id,
          status: 'error',
          error: customerError instanceof Error ? customerError.message : String(customerError),
        })
      }
    }

    const finalStatus =
      counters.errors > 0 && (counters.snapshotsUpdated > 0 || counters.upgradesDetected > 0 || counters.renewalsDetected > 0)
        ? 'parcial'
        : counters.errors > 0
          ? 'erro'
          : 'sucesso'

    const payload = {
      page,
      pageSize,
      maxCustomers,
      customerId: body.customerId ?? null,
      dryRun,
      ...counters,
      details,
    }

    await supabase
      .from('pontuacao_sync_log')
      .update({
        status: finalStatus,
        mensagem: 'Sincronizacao de contratos concluida',
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
