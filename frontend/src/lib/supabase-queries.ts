/**
 * Supabase query helpers — substitui o api-client (localhost:3000).
 * Todos os dados são buscados diretamente do Supabase.
 */
import { supabase } from './supabase-client'
import { getCachedCurrentUserProfile } from './user-management'
import { backendRequest } from './backend-client'

// ── Helpers ──────────────────────────────────────────────────────────────────

let tenantIdCache: { userId: string; tenantId: string | null } | null = null

export function clearCurrentTenantIdCache(): void {
  tenantIdCache = null
}

/** Retorna o tenant_id do usuário autenticado via tabela users */
export async function getCurrentTenantId(): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id
  if (!userId) return null

  const cachedProfile = getCachedCurrentUserProfile()
  if (cachedProfile?.id === userId) {
    tenantIdCache = { userId, tenantId: cachedProfile.tenant_id }
    return cachedProfile.tenant_id
  }

  if (tenantIdCache?.userId === userId) {
    return tenantIdCache.tenantId
  }

  const { data } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .maybeSingle()

  const tenantId = data?.tenant_id ?? null
  tenantIdCache = { userId, tenantId }
  return tenantId
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
  try {
    const params = new URLSearchParams()
    if (options?.customerId) params.set('customerId', options.customerId)
    params.set('limit', String(options?.limit ?? 100))
    const response = await backendRequest<{ data: RedemptionRow[] }>(`/campaign/legacy-redemptions?${params.toString()}`)
    return response.data ?? []
  } catch {
    // Fallback: query Supabase directly when backend is unavailable
    const tenantId = await getCurrentTenantId()
    if (!tenantId) return []

    let redemptionsQuery = supabase
      .from('pontuacao_resgates' as any)
      .select('id, ixc_cliente_id, brinde_id, brinde_nome, pontos_utilizados, status_resgate, data_entrega, responsavel_entrega, observacoes, created_at, updated_at')
      .order('created_at', { ascending: false })
      .eq('tenant_id', tenantId)
      .limit(options?.limit ?? 100)

    if (options?.customerId) {
      redemptionsQuery = redemptionsQuery.eq('ixc_cliente_id', options.customerId)
    }

    const { data: resgates } = await redemptionsQuery as { data: any[] | null }
    if (!resgates || resgates.length === 0) return []

    const customerIds = Array.from(new Set(
      resgates.map((r: any) => String(r.ixc_cliente_id ?? '')).filter(Boolean),
    ))
    let nameMap = new Map<string, string>()

    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('pontuacao_campanha_clientes' as any)
        .select('ixc_cliente_id, nome_cliente')
        .eq('tenant_id', tenantId)
        .in('ixc_cliente_id', customerIds) as { data: any[] | null }

      nameMap = new Map((customers ?? []).map((c: any) => [String(c.ixc_cliente_id), String(c.nome_cliente ?? '')]))
    }

    return (resgates ?? []).map((r: any) => ({
      ...r,
      quantity: 1,
      tipo_destinatario: String(r.ixc_cliente_id ?? '').startsWith('lead:') ? 'contato' : 'cliente',
      destinatario_nome: r.destinatario_nome || null,
      destinatario_telefone: r.destinatario_telefone || null,
      cliente_nome: r.destinatario_nome || nameMap.get(String(r.ixc_cliente_id)) || null,
    })) as RedemptionRow[]
  }
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
  const response = await backendRequest<{
    name: string
    ixc_base_url: string | null
    ixc_user: string | null
    ixc_configured: boolean
    ixc_connection_id: string | null
    ixc_connection_name: string | null
  }>('/settings')

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
  _tenantId: string,
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

  if (opts.connectionId) {
    payload.ixcConnectionId = opts.connectionId
  }

  await backendRequest('/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
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

function mapCampaignRuleSettings(
  campaign: { id: string; nome: string | null; ativa: boolean | null },
  rules: Array<{
    regra_codigo: string | null
    dias_antecedencia_min: number | null
    pontos: number | null
  }>,
): CampaignRuleSettings {
  const byCode = new Map<string, { points: number; days: number | null }>()
  for (const row of rules) {
    const code = String(row.regra_codigo ?? '')
    if (!code) continue
    byCode.set(code, {
      points: Number(row.pontos ?? 0),
      days: row.dias_antecedencia_min === null || row.dias_antecedencia_min === undefined
        ? null
        : Number(row.dias_antecedencia_min),
    })
  }

  return {
    campaignId: String(campaign.id),
    campaignName: String(campaign.nome ?? DEFAULT_CAMPAIGN_RULE_SETTINGS.campaignName),
    active: Boolean(campaign.ativa),
    thresholdEarlyDays: byCode.get('antecipado')?.days ?? DEFAULT_CAMPAIGN_RULE_SETTINGS.thresholdEarlyDays,
    pointsEarly: byCode.get('antecipado')?.points ?? DEFAULT_CAMPAIGN_RULE_SETTINGS.pointsEarly,
    pointsOnDue: byCode.get('no_vencimento')?.points ?? DEFAULT_CAMPAIGN_RULE_SETTINGS.pointsOnDue,
    pointsLate: byCode.get('apos_vencimento')?.points ?? DEFAULT_CAMPAIGN_RULE_SETTINGS.pointsLate,
  }
}

export function createDefaultCampaignRuleSettings(): CampaignRuleSettings {
  return { ...DEFAULT_CAMPAIGN_RULE_SETTINGS }
}

export async function fetchCampaignRuleSettingsList(tenantId: string): Promise<CampaignRuleSettings[]> {
  const { data: campaigns, error: campaignsError } = await (supabase as any)
    .from('pontuacao_campanhas')
    .select('id, nome, ativa, updated_at, created_at')
    .eq('tenant_id', tenantId)
    .order('ativa', { ascending: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })

  if (campaignsError) throw new Error(campaignsError.message)
  if (!campaigns || campaigns.length === 0) return []

  const campaignIds = campaigns.map((campaign: any) => String(campaign.id))
  const { data: rules, error: rulesError } = await (supabase as any)
    .from('pontuacao_campanha_regras')
    .select('campanha_id, regra_codigo, dias_antecedencia_min, pontos, ativo')
    .eq('tenant_id', tenantId)
    .in('campanha_id', campaignIds)
    .eq('ativo', true)

  if (rulesError) throw new Error(rulesError.message)

  const rulesByCampaign = new Map<string, Array<{
    regra_codigo: string | null
    dias_antecedencia_min: number | null
    pontos: number | null
  }>>()

  for (const row of rules ?? []) {
    const campaignId = String(row.campanha_id ?? '')
    if (!campaignId) continue
    const currentRules = rulesByCampaign.get(campaignId) ?? []
    currentRules.push({
      regra_codigo: row.regra_codigo ?? null,
      dias_antecedencia_min: row.dias_antecedencia_min ?? null,
      pontos: row.pontos ?? null,
    })
    rulesByCampaign.set(campaignId, currentRules)
  }

  return campaigns.map((campaign: any) =>
    mapCampaignRuleSettings(
      {
        id: String(campaign.id),
        nome: campaign.nome ?? null,
        ativa: campaign.ativa ?? false,
      },
      rulesByCampaign.get(String(campaign.id)) ?? [],
    ),
  )
}

export async function fetchActiveCampaignRuleSettings(tenantId: string): Promise<CampaignRuleSettings> {
  const { data: campaign, error: campaignError } = await (supabase as any)
    .from('pontuacao_campanhas')
    .select('id, nome, ativa')
    .eq('tenant_id', tenantId)
    .eq('ativa', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (campaignError) throw new Error(campaignError.message)
  if (!campaign) return createDefaultCampaignRuleSettings()

  const { data: rules, error: rulesError } = await (supabase as any)
    .from('pontuacao_campanha_regras')
    .select('regra_codigo, dias_antecedencia_min, pontos, ativo')
    .eq('tenant_id', tenantId)
    .eq('campanha_id', campaign.id)
    .eq('ativo', true)

  if (rulesError) throw new Error(rulesError.message)
  return mapCampaignRuleSettings(
    {
      id: String(campaign.id),
      nome: campaign.nome ?? null,
      ativa: campaign.ativa ?? false,
    },
    (rules ?? []).map((row: any) => ({
      regra_codigo: row.regra_codigo ?? null,
      dias_antecedencia_min: row.dias_antecedencia_min ?? null,
      pontos: row.pontos ?? null,
    })),
  )
}

export async function saveCampaignRuleSettings(
  tenantId: string,
  settings: CampaignRuleSettings,
): Promise<void> {
  const campaignPayload = {
    tenant_id: tenantId,
    nome: settings.campaignName.trim() || 'Campanha padrão',
  }

  let campaignId = settings.campaignId
  if (campaignId) {
    const { error } = await (supabase as any)
      .from('pontuacao_campanhas')
      .update({ nome: campaignPayload.nome })
      .eq('id', campaignId)
      .eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await (supabase as any)
      .from('pontuacao_campanhas')
      .insert({ ...campaignPayload, ativa: false })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    campaignId = String(data.id)
  }

  // Keep a single active campaign per tenant.
  const { error: deactivateError } = await (supabase as any)
    .from('pontuacao_campanhas')
    .update({ ativa: false })
    .eq('tenant_id', tenantId)
    .neq('id', campaignId)
  if (deactivateError) throw new Error(deactivateError.message)

  const { error: activateError } = await (supabase as any)
    .from('pontuacao_campanhas')
    .update({ ativa: true })
    .eq('tenant_id', tenantId)
    .eq('id', campaignId)
  if (activateError) throw new Error(activateError.message)

  const rules = [
    {
      tenant_id: tenantId,
      campanha_id: campaignId,
      regra_codigo: 'antecipado',
      dias_antecedencia_min: Math.max(0, Number(settings.thresholdEarlyDays)),
      pontos: Math.max(0, Number(settings.pointsEarly)),
      ativo: true,
    },
    {
      tenant_id: tenantId,
      campanha_id: campaignId,
      regra_codigo: 'no_vencimento',
      dias_antecedencia_min: null,
      pontos: Math.max(0, Number(settings.pointsOnDue)),
      ativo: true,
    },
    {
      tenant_id: tenantId,
      campanha_id: campaignId,
      regra_codigo: 'apos_vencimento',
      dias_antecedencia_min: null,
      pontos: Math.max(0, Number(settings.pointsLate)),
      ativo: true,
    },
  ]

  const { error: rulesError } = await (supabase as any)
    .from('pontuacao_campanha_regras')
    .upsert(rules, { onConflict: 'campanha_id,regra_codigo' })

  if (rulesError) throw new Error(rulesError.message)
}

export async function deleteCampaignRuleSettings(
  tenantId: string,
  campaignId: string,
): Promise<void> {
  const { data: currentCampaign, error: currentCampaignError } = await (supabase as any)
    .from('pontuacao_campanhas')
    .select('id, ativa')
    .eq('tenant_id', tenantId)
    .eq('id', campaignId)
    .maybeSingle()

  if (currentCampaignError) throw new Error(currentCampaignError.message)
  if (!currentCampaign) return

  const { error: rulesError } = await (supabase as any)
    .from('pontuacao_campanha_regras')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('campanha_id', campaignId)
  if (rulesError) throw new Error(rulesError.message)

  const { error: campaignError } = await (supabase as any)
    .from('pontuacao_campanhas')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', campaignId)
  if (campaignError) throw new Error(campaignError.message)

  if (!currentCampaign.ativa) return

  const { data: replacementCampaign, error: replacementError } = await (supabase as any)
    .from('pontuacao_campanhas')
    .select('id')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (replacementError) throw new Error(replacementError.message)
  if (!replacementCampaign) return

  const { error: activateError } = await (supabase as any)
    .from('pontuacao_campanhas')
    .update({ ativa: true })
    .eq('tenant_id', tenantId)
    .eq('id', replacementCampaign.id)

  if (activateError) throw new Error(activateError.message)
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
