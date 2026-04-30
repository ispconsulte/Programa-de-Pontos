/**
 * Supabase query helpers — substitui o api-client (localhost:3000).
 * Todos os dados são buscados diretamente do Supabase.
 */
import { getSupabaseSession, supabase } from './supabase-client'
import { getCachedCurrentUserProfile, type CurrentUserProfile } from './user-management'
import { backendRequest } from './backend-client'

// ── Helpers ──────────────────────────────────────────────────────────────────

let tenantIdCache: { userId: string; tenantId: string | null; isFullAdmin: boolean } | null = null

export function clearCurrentTenantIdCache(): void {
  tenantIdCache = null
}

export type TenantResolution =
  | { tenantId: string; isFullAdmin: boolean; error: null }
  | { tenantId: null; isFullAdmin: boolean; error: 'no_session' | 'no_user_record' | 'no_tenant' }

/** Resolves the current user's tenant_id and full-admin flag.
 * Returns an error discriminant instead of throwing so callers can show precise messages. */
export async function resolveCurrentTenant(): Promise<TenantResolution> {
  const session = await getSupabaseSession()
  const userId = session?.user?.id
  if (!userId) return { tenantId: null, isFullAdmin: false, error: 'no_session' }

  const cachedProfile = getCachedCurrentUserProfile()
  if (cachedProfile?.id === userId) {
    tenantIdCache = { userId, tenantId: cachedProfile.tenant_id, isFullAdmin: cachedProfile.is_full_admin === true }
    if (!cachedProfile.tenant_id && !cachedProfile.is_full_admin) return { tenantId: null, isFullAdmin: false, error: 'no_tenant' }
    return { tenantId: cachedProfile.tenant_id as string, isFullAdmin: cachedProfile.is_full_admin === true, error: null }
  }

  if (tenantIdCache?.userId === userId) {
    const { tenantId, isFullAdmin } = tenantIdCache
    if (!tenantId && !isFullAdmin) return { tenantId: null, isFullAdmin: false, error: 'no_tenant' }
    return { tenantId: tenantId as string, isFullAdmin, error: null }
  }

  const profile = await backendRequest<CurrentUserProfile>('/users/me')
  const tenantId = profile.tenant_id ?? null
  const isFullAdmin = profile.is_full_admin === true
  tenantIdCache = { userId, tenantId, isFullAdmin }

  if (!tenantId && !isFullAdmin) return { tenantId: null, isFullAdmin: false, error: 'no_tenant' }
  return { tenantId: tenantId as string, isFullAdmin, error: null }
}

/** Retorna o tenant_id do usuário autenticado via tabela users */
export async function getCurrentTenantId(): Promise<string | null> {
  const result = await resolveCurrentTenant()
  return result.tenantId
}

// ── Faturas processadas (Receivables) ────────────────────────────────────────

export interface ReceivableRow {
  id: string
  fatura_id: string
  ixc_cliente_id: string
  ixc_contrato_id: string | null
  competencia: string | null
  data_pagamento: string | null
  valor_pago: number | null
  pontos_gerados: number
  status_processamento: string
  payload: Record<string, unknown>
  created_at: string
  campanha_cliente_id: string | null
}

export interface ReceivablesResult {
  data: ReceivableRow[]
  total: number
  totalPages: number
}

export interface ReceivablesSummary {
  totalRecords: number
  uniqueClients: number
  fivePoints: number
  fourPoints: number
  twoPoints: number
  totalPoints: number
}

export type ReceivableCategoryFilter = 'processado' | 'ignorado' | 'erro' | 'all'

export async function fetchReceivables(opts: {
  tenantId: string
  page: number
  limit: number
  category?: string
  dateFrom?: string
  dateTo?: string
}): Promise<ReceivablesResult> {
  const { tenantId, page, limit, category, dateFrom, dateTo } = opts
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = (supabase as any)
    .from('pontuacao_faturas_processadas')
    .select(
      `id, fatura_id, ixc_cliente_id, ixc_contrato_id, competencia,
       data_pagamento, valor_pago, pontos_gerados, status_processamento,
       payload, created_at, campanha_cliente_id`,
      { count: 'exact' }
    )
    .eq('tenant_id', tenantId)

  if (category && category !== 'all') {
    query = query.eq('status_processamento', category)
  }

  if (dateFrom) {
    query = query.gte('data_pagamento', `${dateFrom}T00:00:00.000Z`)
  }
  if (dateTo) {
    query = query.lte('data_pagamento', `${dateTo}T23:59:59.999Z`)
  }

  query = query.order('data_pagamento', { ascending: false }).range(from, to)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  const total = count ?? 0
  return {
    data: (data ?? []) as unknown as ReceivableRow[],
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export async function fetchReceivablesSummary(opts: {
  tenantId: string
  category?: string
  dateFrom?: string
  dateTo?: string
}): Promise<ReceivablesSummary> {
  const { tenantId, category, dateFrom, dateTo } = opts

  let query = (supabase as any)
    .from('pontuacao_faturas_processadas')
    .select('ixc_cliente_id, pontos_gerados', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .limit(10000)

  if (category && category !== 'all') {
    query = query.eq('status_processamento', category)
  }

  if (dateFrom) {
    query = query.gte('data_pagamento', `${dateFrom}T00:00:00.000Z`)
  }
  if (dateTo) {
    query = query.lte('data_pagamento', `${dateTo}T23:59:59.999Z`)
  }

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<{ ixc_cliente_id: string; pontos_gerados: number | null }>

  return {
    totalRecords: count ?? rows.length,
    uniqueClients: new Set(rows.map((row) => String(row.ixc_cliente_id))).size,
    fivePoints: rows.filter((row) => Number(row.pontos_gerados ?? 0) === 5).length,
    fourPoints: rows.filter((row) => Number(row.pontos_gerados ?? 0) === 4).length,
    twoPoints: rows.filter((row) => Number(row.pontos_gerados ?? 0) === 2).length,
    totalPoints: rows.reduce((sum, row) => sum + Number(row.pontos_gerados ?? 0), 0),
  }
}

export async function fetchReceivableById(
  tenantId: string,
  id: string
): Promise<ReceivableRow | null> {
  const { data, error } = await (supabase as any)
    .from('pontuacao_faturas_processadas')
    .select(
      `id, fatura_id, ixc_cliente_id, ixc_contrato_id, competencia,
       data_pagamento, valor_pago, pontos_gerados, status_processamento,
       payload, created_at, campanha_cliente_id`
    )
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as unknown as ReceivableRow | null)
}

// ── Clientes da campanha ─────────────────────────────────────────────────────

export interface CampaignClientRow {
  id: string
  ixc_cliente_id: string
  ixc_contrato_id: string | null
  nome_cliente: string
  documento: string | null
  email: string | null
  telefone: string | null
  status: string
  pontos_acumulados: number
  pontos_resgatados: number
  pontos_disponiveis: number | null
  ultima_sincronizacao_em: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export async function searchCampaignClients(opts: {
  tenantId: string
  searchType: 'name' | 'cpfCnpj' | 'id'
  query: string
}): Promise<CampaignClientRow[]> {
  const { tenantId, searchType, query } = opts
  const trimmed = query.trim()
  const normalizedDocument = trimmed.replace(/\D/g, '')

  let q = (supabase as any)
    .from('pontuacao_campanha_clientes')
    .select('*')
    .eq('tenant_id', tenantId)
    .limit(50)

  if (searchType === 'name') {
    q = q.ilike('nome_cliente', `%${trimmed}%`)
  } else if (searchType === 'cpfCnpj') {
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return Array.from(
      new Map(
        ((data ?? []) as CampaignClientRow[])
          .filter((row) => String(row.documento ?? '').replace(/\D/g, '').includes(normalizedDocument))
          .map((row) => [row.id, row]),
      ).values(),
    ).slice(0, 50)
  } else {
    q = q.eq('ixc_cliente_id', trimmed)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as CampaignClientRow[]
}

/** Autocomplete: returns up to 10 matching clients for quick suggestions */
export async function autocompleteCampaignClients(opts: {
  tenantId: string
  query: string
}): Promise<CampaignClientRow[]> {
  const { tenantId, query } = opts
  const trimmed = query.trim()
  if (!trimmed || trimmed.length < 2) return []

  const normalizedDocument = trimmed.replace(/\D/g, '')
  const isNumeric = /^\d+$/.test(normalizedDocument)

  let q = (supabase as any)
    .from('pontuacao_campanha_clientes')
    .select('*')
    .eq('tenant_id', tenantId)
    .limit(isNumeric ? 50 : 10)

  if (isNumeric) {
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return Array.from(
      new Map(
        ((data ?? []) as CampaignClientRow[])
          .filter((row) => String(row.documento ?? '').replace(/\D/g, '').includes(normalizedDocument))
          .map((row) => [row.id, row]),
      ).values(),
    ).slice(0, 10)
  } else {
    q = q.ilike('nome_cliente', `%${trimmed}%`)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return Array.from(
    new Map(((data ?? []) as CampaignClientRow[]).map((row) => [row.id, row])).values(),
  )
}

export async function fetchCampaignClientById(
  tenantId: string,
  id: string
): Promise<CampaignClientRow | null> {
  const { data, error } = await (supabase as any)
    .from('pontuacao_campanha_clientes')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as CampaignClientRow | null
}

export async function fetchCampaignClientFaturas(
  tenantId: string,
  campanha_cliente_id: string
): Promise<ReceivableRow[]> {
  const { data, error } = await (supabase as any)
    .from('pontuacao_faturas_processadas')
    .select('id, fatura_id, ixc_contrato_id, competencia, data_pagamento, valor_pago, pontos_gerados, status_processamento, created_at')
    .eq('tenant_id', tenantId)
    .eq('campanha_cliente_id', campanha_cliente_id)
    .order('data_pagamento', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ReceivableRow[]
}

/** Fetch a campaign client by their IXC client ID (not the internal UUID) */
export async function fetchCampaignClientByIxcClienteId(
  tenantId: string,
  ixcClienteId: string
): Promise<CampaignClientRow | null> {
  const { data, error } = await (supabase as any)
    .from('pontuacao_campanha_clientes')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('ixc_cliente_id', ixcClienteId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as CampaignClientRow | null
}

/** Fetch recent paid invoices for a given ixc_cliente_id */
export async function fetchRecentFaturasByIxcClienteId(
  tenantId: string,
  ixcClienteId: string
): Promise<ReceivableRow[]> {
  const { data, error } = await (supabase as any)
    .from('pontuacao_faturas_processadas')
    .select('id, fatura_id, ixc_contrato_id, competencia, data_pagamento, valor_pago, pontos_gerados, status_processamento, created_at, campanha_cliente_id')
    .eq('tenant_id', tenantId)
    .eq('ixc_cliente_id', ixcClienteId)
    .order('data_pagamento', { ascending: false })
    .limit(10)

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ReceivableRow[]
}

/** Fetch client names for a list of ixc_cliente_ids (bulk) */
export async function fetchClientNamesByIxcIds(
  tenantId: string,
  ixcClienteIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ixcClienteIds)]
  if (unique.length === 0) return new Map()

  const { data, error } = await (supabase as any)
    .from('pontuacao_campanha_clientes')
    .select('ixc_cliente_id, nome_cliente')
    .eq('tenant_id', tenantId)
    .in('ixc_cliente_id', unique)

  if (error) throw new Error(error.message)
  const map = new Map<string, string>()
  for (const row of data ?? []) {
    if (row.nome_cliente) map.set(row.ixc_cliente_id, row.nome_cliente)
  }
  return map
}

export interface RedemptionRow {
  id: string
  ixc_cliente_id?: string
  tipo_destinatario?: 'cliente' | 'contato'
  destinatario_nome?: string | null
  destinatario_telefone?: string | null
  brinde_nome: string
  pontos_utilizados: number
  quantity?: number
  status_resgate: string
  data_entrega: string | null
  created_at: string
  updated_at?: string
  observacoes: string | null
}

export async function fetchLegacyRedemptions(options?: {
  customerId?: string
  limit?: number
}): Promise<RedemptionRow[]> {
  const params = new URLSearchParams()
  if (options?.customerId) params.set('customerId', options.customerId)
  params.set('limit', String(options?.limit ?? 100))
  const response = await backendRequest<{ data: RedemptionRow[] }>(`/campaign/legacy-redemptions?${params.toString()}`)
  return response.data ?? []
}

export async function fetchCampaignClientRedemptions(
  ixcClienteId: string
): Promise<RedemptionRow[]> {
  return fetchLegacyRedemptions({ customerId: ixcClienteId, limit: 20 })
}

export interface RankingClientRow {
  id: string
  nome_cliente: string | null
  documento: string | null
  pontos_acumulados: number
  pontos_resgatados: number
  pontos_disponiveis: number | null
  status_campanha: string
}

export async function fetchClientRanking(tenantId: string, limit = 10): Promise<RankingClientRow[]> {
  const { data, error } = await (supabase as any)
    .from('pontuacao_campanha_clientes')
    .select('id, nome_cliente, documento, pontos_acumulados, pontos_resgatados, pontos_disponiveis, status_campanha')
    .eq('tenant_id', tenantId)
    .order('pontos_acumulados', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as RankingClientRow[]
}

export interface IxcConnection {
  id: string
  name: string | null
  ixc_base_url: string
  ixc_user: string
  active: boolean
}

export interface TenantSettings {
  id: string
  name: string
  ixcConnection: IxcConnection | null
  ixc_configured: boolean
}

export async function fetchTenantSettings(tenantId: string): Promise<TenantSettings | null> {
  const params = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
  const response = await backendRequest<{
    name: string
    ixc_base_url: string | null
    ixc_user: string | null
    ixc_configured: boolean
    ixc_connection_id: string | null
    ixc_connection_name: string | null
  }>(`/settings${params}`)

  const conn = response.ixc_configured
    ? {
        id: response.ixc_connection_id,
        name: response.ixc_connection_name,
        ixc_base_url: response.ixc_base_url,
        ixc_user: response.ixc_user,
        active: true,
      }
    : null

  return {
    id: tenantId,
    name: response.name,
    ixcConnection: conn as IxcConnection | null,
    ixc_configured: response.ixc_configured,
  }
}

export async function saveTenantSettings(
  tenantId: string,
  opts: {
    tenantName?: string
    ixcBaseUrl: string
    ixcUser: string
    ixcToken?: string
    connectionId?: string | null
  }
): Promise<void> {
  const payload: Record<string, unknown> = {
    tenantName: opts.tenantName?.trim() || undefined,
    connectionName: opts.tenantName || 'Integração Padrão',
    ixcBaseUrl: opts.ixcBaseUrl,
    ixcUser: opts.ixcUser,
    ixcToken: opts.ixcToken || undefined,
  }

  if (tenantId) {
    payload.tenantId = tenantId
  }

  if (opts.connectionId) {
    payload.ixcConnectionId = opts.connectionId
  }

  await backendRequest('/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

// ── IXC Connections management ───────────────────────────────────────────────

export interface IxcConnectionDetail extends IxcConnection {
  created_at: string | null
  updated_at: string | null
}

export async function fetchIxcConnections(tenantId?: string): Promise<IxcConnectionDetail[]> {
  const params = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
  const response = await backendRequest<{ data: IxcConnectionDetail[] }>(`/settings/ixc/connections${params}`)
  return response.data ?? []
}

export async function createIxcConnection(opts: {
  tenantId?: string
  name: string
  ixcBaseUrl: string
  ixcUser: string
  ixcToken: string
  active?: boolean
}): Promise<{ id: string }> {
  return backendRequest<{ id: string }>('/settings/ixc/connections', {
    method: 'POST',
    body: JSON.stringify({
      name: opts.name,
      tenantId: opts.tenantId,
      ixcBaseUrl: opts.ixcBaseUrl,
      ixcUser: opts.ixcUser,
      ixcToken: opts.ixcToken,
      active: opts.active ?? false,
    }),
  })
}

export async function updateIxcConnection(
  id: string,
  opts: {
    tenantId?: string
    name?: string
    ixcBaseUrl?: string
    ixcUser?: string
    ixcToken?: string
  }
): Promise<void> {
  const params = opts.tenantId ? `?tenantId=${encodeURIComponent(opts.tenantId)}` : ''
  await backendRequest(`/settings/ixc/connections/${id}${params}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: opts.name,
      ixcBaseUrl: opts.ixcBaseUrl,
      ixcUser: opts.ixcUser,
      ixcToken: opts.ixcToken || undefined,
    }),
  })
}

export async function activateIxcConnection(id: string, tenantId?: string): Promise<void> {
  const params = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
  await backendRequest(`/settings/ixc/connections/${id}/activate${params}`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function deactivateIxcConnection(id: string, tenantId?: string): Promise<void> {
  const params = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
  await backendRequest(`/settings/ixc/connections/${id}${params}`, {
    method: 'PUT',
    body: JSON.stringify({ active: false }),
  })
}

// ── Tenants listing (full_admin only) ────────────────────────────────────────

export interface TenantListItem {
  id: string
  name: string
}

export async function fetchAllTenants(): Promise<TenantListItem[]> {
  const response = await backendRequest<{ data?: TenantListItem[] } | null>('/tenants')
  const data = response?.data ?? []
  return data.map((t) => ({ id: t.id, name: t.name || t.id }))
}

// ── Regiões ──────────────────────────────────────────────────────────────────

export interface RegiaoItem {
  id: string
  nome: string
}

export async function fetchRegioes(tenantId?: string): Promise<RegiaoItem[]> {
  const params = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
  const response = await backendRequest<{ data?: RegiaoItem[] } | null>(`/regioes${params}`)
  return response?.data ?? []
}

export async function createRegiao(nome: string, tenantId?: string): Promise<RegiaoItem> {
  return backendRequest<RegiaoItem>('/regioes', {
    method: 'POST',
    body: JSON.stringify({ nome, ...(tenantId ? { tenantId } : {}) }),
  })
}

// ── Campanhas (regras de pontuação) ─────────────────────────────────────────

export interface CampaignRuleSettings {
  campaignId: string | null
  campaignName: string
  active: boolean
  thresholdEarlyDays: number
  pointsEarly: number
  pointsOnDue: number
  pointsLate: number
}

const DEFAULT_CAMPAIGN_RULE_SETTINGS: CampaignRuleSettings = {
  campaignId: null,
  campaignName: 'Campanha padrão',
  active: true,
  thresholdEarlyDays: 3,
  pointsEarly: 5,
  pointsOnDue: 4,
  pointsLate: 2,
}

export function createDefaultCampaignRuleSettings(): CampaignRuleSettings {
  return { ...DEFAULT_CAMPAIGN_RULE_SETTINGS }
}

export async function fetchCampaignRuleSettingsList(tenantId: string): Promise<CampaignRuleSettings[]> {
  void tenantId
  const response = await backendRequest<{ data: CampaignRuleSettings[] }>('/campaign/rule-settings')
  return response.data ?? []
}

export async function fetchActiveCampaignRuleSettings(tenantId: string): Promise<CampaignRuleSettings> {
  const campaigns = await fetchCampaignRuleSettingsList(tenantId)
  return campaigns.find((campaign) => campaign.active) ?? createDefaultCampaignRuleSettings()
}

export async function saveCampaignRuleSettings(
  tenantId: string,
  settings: CampaignRuleSettings,
): Promise<void> {
  void tenantId
  await backendRequest('/campaign/rule-settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  })
}

export async function deleteCampaignRuleSettings(
  tenantId: string,
  campaignId: string,
): Promise<void> {
  void tenantId
  await backendRequest(`/campaign/rule-settings/${campaignId}`, {
    method: 'DELETE',
  })
}

// ── Dashboard (pontuação) ────────────────────────────────────────────────────

export type DashboardSearchType = 'name' | 'cpfCnpj' | 'id'

export interface DashboardMetrics {
  totalPoints: number
  redemptionsCount: number
  availablePoints: number
}

export interface DashboardHistoryRow {
  id: string
  ixc_cliente_id: string
  cliente_nome: string | null
  documento: string | null
  data_vencimento: string | null
  data_pagamento: string | null
  valor_pago: number
  pontos_gerados: number
}

function normalizeDoc(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '')
}

async function fetchClientBasicMap(
  tenantId: string,
  customerIds: string[],
): Promise<Map<string, { nome: string | null; documento: string | null }>> {
  const map = new Map<string, { nome: string | null; documento: string | null }>()
  if (customerIds.length === 0) return map

  const { data, error } = await (supabase as any)
    .from('pontuacao_campanha_clientes')
    .select('ixc_cliente_id, nome_cliente, documento')
    .eq('tenant_id', tenantId)
    .in('ixc_cliente_id', customerIds)

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    map.set(String(row.ixc_cliente_id), {
      nome: row.nome_cliente ? String(row.nome_cliente) : null,
      documento: row.documento ? String(row.documento) : null,
    })
  }
  return map
}

async function resolveCustomerIdsBySearch(
  tenantId: string,
  searchType: DashboardSearchType,
  searchQuery: string,
): Promise<string[]> {
  const trimmed = searchQuery.trim()
  if (!trimmed) return []

  if (searchType === 'id') return [trimmed]

  if (searchType === 'name') {
    const { data, error } = await (supabase as any)
      .from('pontuacao_campanha_clientes')
      .select('ixc_cliente_id')
      .eq('tenant_id', tenantId)
      .ilike('nome_cliente', `%${trimmed}%`)
      .limit(200)
    if (error) throw new Error(error.message)
    return Array.from(new Set((data ?? []).map((row: any) => String(row.ixc_cliente_id))))
  }

  const normalized = normalizeDoc(trimmed)
  if (!normalized) return []

  const { data, error } = await (supabase as any)
    .from('pontuacao_campanha_clientes')
    .select('ixc_cliente_id, documento')
    .eq('tenant_id', tenantId)
    .limit(5000)
  if (error) throw new Error(error.message)

  return Array.from(
    new Set(
      (data ?? [])
        .filter((row: any) => normalizeDoc(row.documento).includes(normalized))
        .map((row: any) => String(row.ixc_cliente_id)),
    ),
  )
}

export async function fetchDashboardMetrics(opts: {
  tenantId: string
  dateFrom: string
  dateTo: string
}): Promise<DashboardMetrics> {
  const { tenantId, dateFrom, dateTo } = opts

  const params = new URLSearchParams({
    limit: '1',
    dateFrom,
    dateTo,
  })

  const [pointsResult, clientsResult, legacyResult] = await Promise.all([
    (supabase as any)
      .from('pontuacao_faturas_processadas')
      .select('pontos_gerados')
      .eq('tenant_id', tenantId)
      .eq('status_processamento', 'processado')
      .gte('data_pagamento', `${dateFrom}T00:00:00.000Z`)
      .lte('data_pagamento', `${dateTo}T23:59:59.999Z`)
      .limit(10000),
    (supabase as any)
      .from('pontuacao_campanha_clientes')
      .select('pontos_resgatados, pontos_disponiveis')
      .eq('tenant_id', tenantId),
    backendRequest<{ data: any[]; meta?: { total?: number } }>(`/campaign/legacy-redemptions?${params.toString()}`).catch(() => null),
  ])

  if (pointsResult.error) throw new Error(pointsResult.error.message)
  if (clientsResult.error) throw new Error(clientsResult.error.message)

  const clientRows = clientsResult.data ?? []

  const availablePoints = clientRows.reduce(
    (sum: number, row: any) => sum + Number(row.pontos_disponiveis ?? 0),
    0,
  )

  const clientsWithRedemptions = clientRows.reduce(
    (sum: number, row: any) => sum + (Number(row.pontos_resgatados ?? 0) > 0 ? 1 : 0),
    0,
  )

  const backendRedemptionsCount = Number(legacyResult?.meta?.total ?? 0)

  return {
    totalPoints: (pointsResult.data ?? []).reduce((sum: number, row: any) => sum + Number(row.pontos_gerados ?? 0), 0),
    redemptionsCount: Math.max(backendRedemptionsCount, clientsWithRedemptions),
    availablePoints,
  }
}

export async function fetchDashboardHistory(opts: {
  tenantId: string
  dateFrom: string
  dateTo: string
  limit?: number
  searchType?: DashboardSearchType
  searchQuery?: string
}): Promise<DashboardHistoryRow[]> {
  const { tenantId, dateFrom, dateTo } = opts
  const limit = Math.max(1, Math.min(50, Number(opts.limit ?? 8)))
  const searchType = opts.searchType ?? 'name'
  const searchQuery = opts.searchQuery?.trim() ?? ''

  let allowedCustomerIds: string[] | null = null
  if (searchQuery) {
    allowedCustomerIds = await resolveCustomerIdsBySearch(tenantId, searchType, searchQuery)
    if (allowedCustomerIds.length === 0) return []
  }

  let query = (supabase as any)
    .from('pontuacao_faturas_processadas')
    .select('id, ixc_cliente_id, competencia, data_pagamento, valor_pago, pontos_gerados, payload')
    .eq('tenant_id', tenantId)
    .eq('status_processamento', 'processado')
    .gte('data_pagamento', `${dateFrom}T00:00:00.000Z`)
    .lte('data_pagamento', `${dateTo}T23:59:59.999Z`)
    .order('data_pagamento', { ascending: false })
    .limit(limit)

  if (allowedCustomerIds && allowedCustomerIds.length > 0) {
    query = query.in('ixc_cliente_id', allowedCustomerIds)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = data ?? []
  const customerIds: string[] = Array.from(new Set(rows.map((row: any) => String(row.ixc_cliente_id))))
  const customerMap = await fetchClientBasicMap(tenantId, customerIds)

  return rows.map((row: any) => {
    const customerId = String(row.ixc_cliente_id)
    const customer = customerMap.get(customerId)
    const payload = (row.payload ?? {}) as Record<string, unknown>
    const dueDate = typeof payload.dueDateIso === 'string'
      ? payload.dueDateIso
      : row.competencia

    return {
      id: String(row.id),
      ixc_cliente_id: customerId,
      cliente_nome: customer?.nome ?? null,
      documento: customer?.documento ?? null,
      data_vencimento: dueDate ? String(dueDate) : null,
      data_pagamento: row.data_pagamento ? String(row.data_pagamento) : null,
      valor_pago: Number(row.valor_pago ?? 0),
      pontos_gerados: Number(row.pontos_gerados ?? 0),
    }
  })
}
