import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { backendRequest } from '@/lib/backend-client'
import { fetchRewardCatalogItems } from '@/lib/loyalty-admin'
import { fetchLegacyRedemptions } from '@/lib/supabase-queries'

type ClienteEmDiaCampaignStatus = 'ativo' | 'inativo' | 'bloqueado'
const CLIENTE_EM_DIA_CACHE_TTL_MS = 60_000

export interface ClienteEmDiaOverviewItem {
  id: string
  ixcClienteId: string
  ixcContratoId: string | null
  nomeCliente: string
  documento: string | null
  email: string | null
  telefone: string | null
  statusCampanha: ClienteEmDiaCampaignStatus
  pontosAcumulados: number
  pontosResgatados: number
  pontosDisponiveis: number
  ultimaSincronizacaoEm: string | null
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface ClienteEmDiaHistoricoItem {
  id: string
  campanhaClienteId: string
  tipoMovimentacao: 'credito' | 'debito' | 'ajuste' | 'resgate' | 'estorno'
  origem: string
  descricao: string
  pontosMovimentados: number
  saldoApos: number | null
  referenciaExterna: string | null
  createdAt: string
  payload: Record<string, unknown>
}

export interface ClienteEmDiaManualAdjustmentItem {
  id: string
  customerName: string
  customerDocument: string | null
  adjustmentType: 'credit' | 'debit'
  points: number
  reason: string
  actorName: string
  previousBalance: number
  newBalance: number
  createdAt: string
}

export interface ClienteEmDiaRewardItem {
  id: string
  nome: string
  descricao: string | null
  pontosNecessarios: number
  ativo: boolean
  estoqueDisponivel: number | null
  imagemUrl: string | null
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface ClienteEmDiaRedemptionItem {
  id: string
  campanhaClienteId: string
  catalogoBrindeId: string
  brindeNome: string
  responsavelEntrega: string | null
  status: 'pendente' | 'aprovado' | 'entregue' | 'cancelado'
  pontosResgatados: number
  observacoes: string | null
  solicitadoEm: string
  aprovadoEm: string | null
  entregueEm: string | null
  canceladoEm: string | null
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface ClienteEmDiaMinimalSettings {
  activeIxcConnection: {
    id: string
    name: string | null
    ixcBaseUrl: string
    active: boolean
  } | null
  latestSync: {
    id: string
    status: string
    tipoSync: string
    iniciadoEm: string
    finalizadoEm: string | null
    mensagem: string | null
  } | null
  latestRules: Array<{
    id: string
    eventType: string
    ruleCode: string
    points: number
    active: boolean
    description: string
  }>
}

export interface ClienteEmDiaCustomerDetail {
  customer: ClienteEmDiaOverviewItem | null
  historico: ClienteEmDiaHistoricoItem[]
  resgates: ClienteEmDiaRedemptionItem[]
  manualAdjustments: ClienteEmDiaManualAdjustmentItem[]
}

export interface UseClienteEmDiaResult {
  loading: boolean
  error: string | null
  overview: ClienteEmDiaOverviewItem[]
  customerDetail: ClienteEmDiaCustomerDetail | null
  rewards: ClienteEmDiaRewardItem[]
  redemptions: ClienteEmDiaRedemptionItem[]
  settings: ClienteEmDiaMinimalSettings | null
  reload: () => Promise<void>
}

interface UseClienteEmDiaOptions {
  customerId?: string
  rewardsOnly?: boolean
  redemptionsCustomerId?: string
}

interface UseClienteEmDiaCacheEntry {
  expiresAt: number
  data: Omit<UseClienteEmDiaResult, 'reload'>
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function normalizeOverviewItem(row: Record<string, unknown>): ClienteEmDiaOverviewItem {
  return {
    id: String(row.id),
    ixcClienteId: String(row.ixc_cliente_id ?? row.customer_id ?? ''),
    ixcContratoId: typeof row.ixc_contrato_id === 'string' ? row.ixc_contrato_id : null,
    nomeCliente: String(row.nome_cliente ?? row.nome ?? row.display_name ?? ''),
    documento: typeof row.documento === 'string' ? row.documento : null,
    email: typeof row.email === 'string' ? row.email : null,
    telefone: typeof row.telefone === 'string' ? row.telefone : null,
    statusCampanha: String(row.status ?? row.status_campanha ?? 'inativo') as ClienteEmDiaCampaignStatus,
    pontosAcumulados: Number(row.pontos_acumulados ?? 0),
    pontosResgatados: Number(row.pontos_resgatados ?? 0),
    pontosDisponiveis: Number(row.pontos_disponiveis ?? 0),
    ultimaSincronizacaoEm: typeof row.ultima_sincronizacao_em === 'string'
      ? row.ultima_sincronizacao_em
      : typeof row.updated_at === 'string'
        ? row.updated_at
        : null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    metadata: asRecord(row.metadata),
  }
}

function normalizeHistoricoItem(row: Record<string, unknown>): ClienteEmDiaHistoricoItem {
  const points = Number(row.pontos ?? 0)
  const payload = asRecord(row.payload)
  return {
    id: String(row.id),
    campanhaClienteId: String(row.ixc_cliente_id ?? ''),
    tipoMovimentacao: String(
      row.tipo_evento === 'ajuste_manual'
        ? 'ajuste'
        : row.tipo_evento ?? 'credito',
    ) as ClienteEmDiaHistoricoItem['tipoMovimentacao'],
    origem: String(row.criado_por ?? 'sistema'),
    descricao: String(row.descricao ?? row.tipo_evento ?? ''),
    pontosMovimentados: points,
    saldoApos: typeof payload.newBalance === 'number'
      ? Number(payload.newBalance)
      : typeof payload.new_balance === 'number'
        ? Number(payload.new_balance)
        : null,
    referenciaExterna: typeof row.ixc_fatura_id === 'string' ? row.ixc_fatura_id : null,
    createdAt: String(row.created_at ?? ''),
    payload,
  }
}

function normalizeManualAdjustmentItem(row: Record<string, unknown>): ClienteEmDiaManualAdjustmentItem {
  return {
    id: String(row.id),
    customerName: String(row.customer_name_snapshot ?? 'Cliente'),
    customerDocument: typeof row.customer_document_snapshot === 'string' ? row.customer_document_snapshot : null,
    adjustmentType: String(row.adjustment_type ?? 'credit') as ClienteEmDiaManualAdjustmentItem['adjustmentType'],
    points: Number(row.points ?? 0),
    reason: String(row.reason ?? ''),
    actorName: String(row.actor_name_snapshot ?? 'Usuário'),
    previousBalance: Number(row.previous_balance ?? 0),
    newBalance: Number(row.new_balance ?? 0),
    createdAt: String(row.created_at ?? ''),
  }
}

function normalizeRewardItem(row: Record<string, unknown>): ClienteEmDiaRewardItem {
  return {
    id: String(row.id),
    nome: String(row.nome ?? ''),
    descricao: typeof row.descricao === 'string' ? row.descricao : null,
    pontosNecessarios: Number(row.pontos_necessarios ?? 0),
    ativo: Boolean(row.ativo),
    estoqueDisponivel: typeof row.estoque_disponivel === 'number'
      ? row.estoque_disponivel
      : typeof row.estoque === 'number'
        ? row.estoque
        : row.estoque_disponivel === null || row.estoque === null
          ? null
          : Number(row.estoque_disponivel ?? row.estoque ?? 0),
    imagemUrl: typeof row.imagem_url === 'string' ? row.imagem_url : null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    metadata: asRecord(row.metadata),
  }
}

function normalizeRedemptionItem(row: Record<string, unknown>): ClienteEmDiaRedemptionItem {
  const fallbackTimestamp =
    typeof row.created_at === 'string' ? row.created_at : ''

  return {
    id: String(row.id),
    campanhaClienteId: String(row.ixc_cliente_id ?? ''),
    catalogoBrindeId: String(row.brinde_id ?? ''),
    brindeNome: String(row.brinde_nome ?? 'Brinde'),
    responsavelEntrega: typeof row.responsavel_entrega === 'string' ? row.responsavel_entrega : null,
    status: String(row.status_resgate ?? 'pendente') as ClienteEmDiaRedemptionItem['status'],
    pontosResgatados: Number(row.pontos_utilizados ?? 0),
    observacoes: typeof row.observacoes === 'string' ? row.observacoes : null,
    solicitadoEm: fallbackTimestamp,
    aprovadoEm: null,
    entregueEm: typeof row.data_entrega === 'string' ? row.data_entrega : null,
    canceladoEm: null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    metadata: {},
  }
}

const clienteEmDiaCache = new Map<string, UseClienteEmDiaCacheEntry>()

function getClienteEmDiaCacheKey(options: UseClienteEmDiaOptions): string {
  return JSON.stringify({
    customerId: options.customerId ?? null,
    rewardsOnly: Boolean(options.rewardsOnly),
    redemptionsCustomerId: options.redemptionsCustomerId ?? null,
  })
}

export function useClienteEmDia(options: UseClienteEmDiaOptions = {}): UseClienteEmDiaResult {
  const db = supabase as unknown as {
    from: (table: string) => any
  }
  const cacheKey = getClienteEmDiaCacheKey(options)
  const cachedEntry = clienteEmDiaCache.get(cacheKey)
  const freshCache = cachedEntry && cachedEntry.expiresAt > Date.now() ? cachedEntry.data : null
  const [loading, setLoading] = useState(!freshCache)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<ClienteEmDiaOverviewItem[]>(freshCache?.overview ?? [])
  const [customerDetail, setCustomerDetail] = useState<ClienteEmDiaCustomerDetail | null>(freshCache?.customerDetail ?? null)
  const [rewards, setRewards] = useState<ClienteEmDiaRewardItem[]>(freshCache?.rewards ?? [])
  const [redemptions, setRedemptions] = useState<ClienteEmDiaRedemptionItem[]>(freshCache?.redemptions ?? [])
  const [settings, setSettings] = useState<ClienteEmDiaMinimalSettings | null>(freshCache?.settings ?? null)

  useEffect(() => {
    const currentCache = clienteEmDiaCache.get(cacheKey)
    if (currentCache && currentCache.expiresAt > Date.now()) {
      setError(null)
      setOverview(currentCache.data.overview)
      setCustomerDetail(currentCache.data.customerDetail)
      setRewards(currentCache.data.rewards)
      setRedemptions(currentCache.data.redemptions)
      setSettings(currentCache.data.settings)
      setLoading(false)
      return
    }

    void load()
  }, [cacheKey, options.customerId, options.redemptionsCustomerId, options.rewardsOnly])

  async function load(force = false) {
    const currentCache = clienteEmDiaCache.get(cacheKey)
    if (!force && currentCache && currentCache.expiresAt > Date.now()) {
      setError(null)
      setOverview(currentCache.data.overview)
      setCustomerDetail(currentCache.data.customerDetail)
      setRewards(currentCache.data.rewards)
      setRedemptions(currentCache.data.redemptions)
      setSettings(currentCache.data.settings)
      setLoading(false)
      return
    }

    if (!overview.length && !rewards.length && !redemptions.length && !customerDetail && !settings) {
      setLoading(true)
    }
    setError(null)

    try {
      if (options.rewardsOnly) {
        const rewardsData = await fetchRewardCatalogItems()
        const nextRewards = (rewardsData ?? []).map((row: unknown) => normalizeRewardItem(row as Record<string, unknown>))

        setRewards(nextRewards)
        setOverview([])
        setRedemptions([])
        setCustomerDetail(null)
        setSettings(null)
        clienteEmDiaCache.set(cacheKey, {
          expiresAt: Date.now() + CLIENTE_EM_DIA_CACHE_TTL_MS,
          data: {
            loading: false,
            error: null,
            overview: [],
            customerDetail: null,
            rewards: nextRewards,
            redemptions: [],
            settings: null,
          },
        })
        return
      }

      const overviewQuery = db
        .from('pontuacao_campanha_clientes')
        .select('*')
        .order('updated_at', { ascending: false })

      const latestSyncQuery = db
        .from('pontuacao_sync_log')
        .select('*')
        .limit(1)
        .maybeSingle()

      const [
        overviewResult,
        rewardsResult,
        latestSyncResult,
        settingsResult,
        redemptionsResult,
      ] = await Promise.all([
        overviewQuery,
        fetchRewardCatalogItems(),
        latestSyncQuery,
        backendRequest<{
          name: string
          ixc_base_url: string | null
          ixc_user: string | null
          ixc_configured: boolean
          ixc_connection_id: string | null
          ixc_connection_name: string | null
        }>('/settings').catch(() => null),
        fetchLegacyRedemptions({
          customerId: options.redemptionsCustomerId,
          limit: 100,
        }),
      ])

      if (overviewResult.error) throw overviewResult.error
      if (latestSyncResult.error) throw latestSyncResult.error
      const overviewItems = (overviewResult.data ?? []).map((row: unknown) => normalizeOverviewItem(row as Record<string, unknown>))
      const rewardItems = (rewardsResult ?? []).map((row: unknown) => normalizeRewardItem(row as Record<string, unknown>))
      const redemptionItems = (redemptionsResult ?? []).map((row: unknown) => normalizeRedemptionItem(row as Record<string, unknown>))
      const nextSettings: ClienteEmDiaMinimalSettings = {
        activeIxcConnection: settingsResult?.ixc_configured
          ? {
              id: String(settingsResult?.ixc_connection_id ?? ''),
              name: settingsResult?.ixc_connection_name ?? null,
              ixcBaseUrl: String(settingsResult?.ixc_base_url ?? ''),
              active: Boolean(settingsResult?.ixc_configured),
            }
          : null,
        latestSync: latestSyncResult.data
          ? {
              id: String(latestSyncResult.data.id),
              status: String(latestSyncResult.data.status ?? latestSyncResult.data.estado ?? ''),
              tipoSync: String(latestSyncResult.data.tipo_sync ?? latestSyncResult.data.tipo ?? 'sync'),
              iniciadoEm: String(latestSyncResult.data.iniciado_em ?? latestSyncResult.data.created_at ?? ''),
              finalizadoEm: typeof latestSyncResult.data.finalizado_em === 'string'
                ? latestSyncResult.data.finalizado_em
                : typeof latestSyncResult.data.updated_at === 'string'
                  ? latestSyncResult.data.updated_at
                  : null,
              mensagem: typeof latestSyncResult.data.mensagem === 'string' ? latestSyncResult.data.mensagem : null,
            }
          : null,
        latestRules: [],
      }

      setOverview(overviewItems)
      setRewards(rewardItems)
      setRedemptions(redemptionItems)
      setSettings(nextSettings)

      if (!options.customerId) {
        setCustomerDetail(null)
        clienteEmDiaCache.set(cacheKey, {
          expiresAt: Date.now() + CLIENTE_EM_DIA_CACHE_TTL_MS,
          data: {
            loading: false,
            error: null,
            overview: overviewItems,
            customerDetail: null,
            rewards: rewardItems,
            redemptions: redemptionItems,
            settings: nextSettings,
          },
        })
        return
      }

      const customer = overviewItems.find((item: ClienteEmDiaOverviewItem) => item.ixcClienteId === options.customerId) ?? null

      if (!customer) {
        setCustomerDetail({
          customer: null,
          historico: [],
          resgates: [],
          manualAdjustments: [],
        })
        return
      }

      const [historicoResult, manualAdjustmentsResult, customerRedemptionsResult] = await Promise.all([
        db
          .from('pontuacao_historico')
          .select('*')
          .eq('ixc_cliente_id', customer.ixcClienteId)
          .order('created_at', { ascending: false }),
        db
          .from('pontuacao_ajustes_manuais')
          .select('*')
          .eq('ixc_cliente_id', customer.ixcClienteId)
          .order('created_at', { ascending: false }),
        fetchLegacyRedemptions({
          customerId: customer.ixcClienteId,
          limit: 50,
        }),
      ])

      if (historicoResult.error) throw historicoResult.error
      const manualAdjustmentsError = manualAdjustmentsResult.error
      if (manualAdjustmentsError && !String(manualAdjustmentsError.message ?? '').includes('pontuacao_ajustes_manuais')) {
        throw manualAdjustmentsError
      }

      const nextCustomerDetail = {
        customer,
        historico: (historicoResult.data ?? []).map((row: unknown) => normalizeHistoricoItem(row as Record<string, unknown>)),
        resgates: (customerRedemptionsResult ?? []).map((row: unknown) => normalizeRedemptionItem(row as Record<string, unknown>)),
        manualAdjustments: manualAdjustmentsError
          ? []
          : (manualAdjustmentsResult.data ?? []).map((row: unknown) => normalizeManualAdjustmentItem(row as Record<string, unknown>)),
      }

      setCustomerDetail(nextCustomerDetail)
      clienteEmDiaCache.set(cacheKey, {
        expiresAt: Date.now() + CLIENTE_EM_DIA_CACHE_TTL_MS,
        data: {
          loading: false,
          error: null,
          overview: overviewItems,
          customerDetail: nextCustomerDetail,
          rewards: rewardItems,
          redemptions: redemptionItems,
          settings: nextSettings,
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os dados do Cliente em Dia.')
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    error,
    overview,
    customerDetail,
    rewards,
    redemptions,
    settings,
    reload: () => load(true),
  }
}

export default useClienteEmDia
