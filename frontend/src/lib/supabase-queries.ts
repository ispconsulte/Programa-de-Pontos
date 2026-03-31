/**
 * Supabase query helpers — substitui o api-client (localhost:3000).
 * Todos os dados são buscados diretamente do Supabase.
 */
import { supabase } from './supabase-client'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Retorna o tenant_id do usuário autenticado via tabela users */
export async function getCurrentTenantId(): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id
  if (!userId) return null

  const { data } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .maybeSingle()

  return data?.tenant_id ?? null
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

  let q = (supabase as any)
    .from('pontuacao_campanha_clientes')
    .select('*')
    .eq('tenant_id', tenantId)
    .limit(50)

  if (searchType === 'name') {
    q = q.ilike('nome_cliente', `%${query}%`)
  } else if (searchType === 'cpfCnpj') {
    q = q.ilike('documento', `%${query.replace(/\D/g, '')}%`)
  } else {
    q = q.eq('ixc_cliente_id', query)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as CampaignClientRow[]
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

// ── Configurações (tenant + ixc_connections) ──────────────────────────────────

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
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantErr) throw new Error(tenantErr.message)
  if (!tenant) return null

  const { data: conn, error: connErr } = await supabase
    .from('ixc_connections')
    .select('id, name, ixc_base_url, ixc_user, active')
    .eq('tenant_id', tenantId)
    .order('active', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (connErr) throw new Error(connErr.message)

  return {
    id: tenant.id,
    name: tenant.name,
    ixcConnection: conn as IxcConnection | null,
    ixc_configured: !!conn,
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
  // Atualiza nome e os dados espelhados do IXC no próprio tenant (legado/compatibilidade)
  const tenantUpdateData: Record<string, string> = {}
  if (opts.tenantName?.trim()) tenantUpdateData.name = opts.tenantName.trim()
  if (opts.ixcBaseUrl) tenantUpdateData.ixc_base_url = opts.ixcBaseUrl
  if (opts.ixcUser) tenantUpdateData.ixc_user = opts.ixcUser

  if (opts.ixcToken) {
    const hexToken = '\\x' + Array.from(opts.ixcToken).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    tenantUpdateData.ixc_token_enc = hexToken
    tenantUpdateData.ixc_token_iv = '\\x00'
  }

  if (Object.keys(tenantUpdateData).length > 0) {
    const { error } = await supabase
      .from('tenants')
      .update(tenantUpdateData)
      .eq('id', tenantId)
    if (error) throw new Error(error.message)
  }

  // Upsert da conexão IXC (sem token, pois criptografia ocorre na Edge Function)
  // Se token for fornecido, deve ser enviado para a Edge Function de configuração
  if (opts.connectionId) {
    const updateData: Record<string, unknown> = {
      ixc_base_url: opts.ixcBaseUrl,
      ixc_user: opts.ixcUser,
    }
    const { error } = await supabase
      .from('ixc_connections')
      .update(updateData)
      .eq('id', opts.connectionId)
      .eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)

    // Se a intenção era também atualizar o token, faríamos aqui.
    // Opcionalmente atualizamos o token no registro existente
    if (opts.ixcToken) {
      const hexToken = '\\x' + Array.from(opts.ixcToken).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
      const { error: updErr } = await supabase
        .from('ixc_connections')
        .update({ ixc_token_enc: hexToken, ixc_token_iv: '\\x00' })
        .eq('id', opts.connectionId)
      if (updErr) throw new Error(updErr.message)
    }

  } else {
    // Se não houver connectionId, insere um novo registro diretamente (CRUD)
    // Converte o token string para formato aceito pelo col bytea no PostgREST (\x...)
    const hexToken = opts.ixcToken
      ? '\\x' + Array.from(opts.ixcToken).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
      : null

    const insertData: Record<string, unknown> = {
      tenant_id: tenantId,
      name: opts.tenantName || 'Integração Padrão',
      ixc_base_url: opts.ixcBaseUrl,
      ixc_user: opts.ixcUser,
      active: true,
    }

    if (hexToken) {
      insertData.ixc_token_enc = hexToken
      insertData.ixc_token_iv = '\\x00' // IV dummy devido à obrigação de formato
    }

    const { error: insertError } = await (supabase as any).from('ixc_connections').insert(insertData)
    if (insertError) throw new Error(insertError.message)
  }
}
