import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-client'

type ClienteEmDiaCampaignStatus = 'ativo' | 'inativo' | 'bloqueado'

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

export interface ClienteEmDiaRewardItem {
  id: string
  nome: string
  descricao: string | null
  pontosNecessarios: number
  ativo: boolean
  estoqueDisponivel: number | null
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface ClienteEmDiaRedemptionItem {
  id: string
  campanhaClienteId: string
  catalogoBrindeId: string
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
  return {
    id: String(row.id),
    campanhaClienteId: String(row.campanha_cliente_id),
    tipoMovimentacao: String(row.tipo_movimentacao) as ClienteEmDiaHistoricoItem['tipoMovimentacao'],
    origem: String(row.origem ?? ''),
    descricao: String(row.descricao ?? ''),
    pontosMovimentados: Number(row.pontos_movimentados ?? 0),
    saldoApos: typeof row.saldo_apos === 'number' ? row.saldo_apos : row.saldo_apos === null ? null : Number(row.saldo_apos ?? 0),
    referenciaExterna: typeof row.referencia_externa === 'string' ? row.referencia_externa : null,
    createdAt: String(row.created_at ?? ''),
    payload: asRecord(row.payload),
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
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    metadata: asRecord(row.metadata),
  }
}

function normalizeRedemptionItem(row: Record<string, unknown>): ClienteEmDiaRedemptionItem {
  const fallbackTimestamp =
    typeof row.solicitado_em === 'string'
      ? row.solicitado_em
      : typeof row.created_at === 'string'
        ? row.created_at
        : ''

  return {
    id: String(row.id),
    campanhaClienteId: String(row.campanha_cliente_id),
    catalogoBrindeId: String(row.catalogo_brinde_id),
    status: String(row.status ?? 'pendente') as ClienteEmDiaRedemptionItem['status'],
    pontosResgatados: Number(row.pontos_resgatados ?? 0),
    observacoes: typeof row.observacoes === 'string' ? row.observacoes : null,
    solicitadoEm: fallbackTimestamp,
    aprovadoEm: typeof row.aprovado_em === 'string' ? row.aprovado_em : null,
    entregueEm: typeof row.entregue_em === 'string' ? row.entregue_em : null,
    canceladoEm: typeof row.cancelado_em === 'string' ? row.cancelado_em : null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    metadata: asRecord(row.metadata),
  }
}

export function useClienteEmDia(options: UseClienteEmDiaOptions = {}): UseClienteEmDiaResult {
  const db = supabase as unknown as {
    from: (table: string) => any
  }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<ClienteEmDiaOverviewItem[]>([])
  const [customerDetail, setCustomerDetail] = useState<ClienteEmDiaCustomerDetail | null>(null)
  const [rewards, setRewards] = useState<ClienteEmDiaRewardItem[]>([])
  const [redemptions, setRedemptions] = useState<ClienteEmDiaRedemptionItem[]>([])
  const [settings, setSettings] = useState<ClienteEmDiaMinimalSettings | null>(null)

  useEffect(() => {
    void load()
  }, [options.customerId, options.redemptionsCustomerId, options.rewardsOnly])

  async function load() {
    setLoading(true)
    setError(null)

    try {
      const rewardsQuery = db
        .from('pontuacao_catalogo_brindes')
        .select('*')
        .order('ativo', { ascending: false })
        .order('pontos_necessarios', { ascending: true })
        .order('nome', { ascending: true })

      if (options.rewardsOnly) {
        const { data: rewardsData, error: rewardsError } = await rewardsQuery
        if (rewardsError) throw rewardsError

        setRewards((rewardsData ?? []).map((row: unknown) => normalizeRewardItem(row as Record<string, unknown>)))
        setOverview([])
        setRedemptions([])
        setCustomerDetail(null)
        setSettings(null)
        return
      }

      const overviewQuery = db
        .from('pontuacao_campanha_clientes')
        .select('*')
        .order('updated_at', { ascending: false })

      const redemptionsQuery = (() => {
        let query = db
          .from('pontuacao_resgates')
          .select('*')
          .order('created_at', { ascending: false })

        if (options.redemptionsCustomerId) {
          query = query.eq('campanha_cliente_id', options.redemptionsCustomerId)
        }

        return query
      })()

      const latestSyncQuery = db
        .from('pontuacao_sync_log')
        .select('*')
        .limit(1)
        .maybeSingle()

      const ixcConnectionQuery = db
        .from('ixc_connections')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      const [
        overviewResult,
        rewardsResult,
        redemptionsResult,
        latestSyncResult,
        ixcConnectionResult,
      ] = await Promise.all([
        overviewQuery,
        rewardsQuery,
        redemptionsQuery,
        latestSyncQuery,
        ixcConnectionQuery,
      ])

      if (overviewResult.error) throw overviewResult.error
      if (rewardsResult.error) throw rewardsResult.error
      if (redemptionsResult.error) throw redemptionsResult.error
      if (latestSyncResult.error) throw latestSyncResult.error
      if (ixcConnectionResult.error) throw ixcConnectionResult.error

      const overviewItems = (overviewResult.data ?? []).map((row: unknown) => normalizeOverviewItem(row as Record<string, unknown>))
      const rewardItems = (rewardsResult.data ?? []).map((row: unknown) => normalizeRewardItem(row as Record<string, unknown>))
      const redemptionItems = (redemptionsResult.data ?? []).map((row: unknown) => normalizeRedemptionItem(row as Record<string, unknown>))

      setOverview(overviewItems)
      setRewards(rewardItems)
      setRedemptions(redemptionItems)
      setSettings({
        activeIxcConnection: ixcConnectionResult.data
          ? {
              id: String(ixcConnectionResult.data.id),
              name: typeof ixcConnectionResult.data.name === 'string' ? ixcConnectionResult.data.name : null,
              ixcBaseUrl: String(ixcConnectionResult.data.ixc_base_url ?? ''),
              active: Boolean(ixcConnectionResult.data.active),
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
      })

      if (!options.customerId) {
        setCustomerDetail(null)
        return
      }

      const customer = overviewItems.find((item: ClienteEmDiaOverviewItem) => item.ixcClienteId === options.customerId) ?? null

      if (!customer) {
        setCustomerDetail({
          customer: null,
          historico: [],
          resgates: [],
        })
        return
      }

      const [historicoResult, customerRedemptionsResult] = await Promise.all([
        db
          .from('pontuacao_historico')
          .select('*')
          .eq('campanha_cliente_id', customer.id)
          .order('created_at', { ascending: false }),
        db
          .from('pontuacao_resgates')
          .select('*')
          .eq('campanha_cliente_id', customer.id)
          .order('created_at', { ascending: false }),
      ])

      if (historicoResult.error) throw historicoResult.error
      if (customerRedemptionsResult.error) throw customerRedemptionsResult.error

      setCustomerDetail({
        customer,
        historico: (historicoResult.data ?? []).map((row: unknown) => normalizeHistoricoItem(row as Record<string, unknown>)),
        resgates: (customerRedemptionsResult.data ?? []).map((row: unknown) => normalizeRedemptionItem(row as Record<string, unknown>)),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel carregar os dados do Cliente em Dia.')
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
    reload: load,
  }
}

export default useClienteEmDia
