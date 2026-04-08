import { useCallback, useEffect, useMemo, useState } from 'react'
import { useThrottledAction } from '@/hooks/useThrottledAction'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  Coins,
  Gift,
  LayoutDashboard,
  RefreshCw,
  Settings2,
  ShoppingBag,
  Ticket,
  Users,
  Wallet,
  Zap,
  Clock,
  CalendarCheck,
} from 'lucide-react'
import Layout, { DASHBOARD_CLIENT_SEARCH_EVENT, type DashboardSearchType as HeaderSearchType } from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import StatCard from '@/components/StatCard'
import AlertBanner from '@/components/AlertBanner'
import Spinner from '@/components/Spinner'
import EmptyState from '@/components/EmptyState'
import { categoryBadge } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import {
  fetchDashboardHistory,
  fetchDashboardMetrics,
  getCurrentTenantId,
  type DashboardHistoryRow,
} from '@/lib/supabase-queries'
import { fetchCurrentUserProfile, isAdminUiRole } from '@/lib/user-management'
import { useClienteEmDia } from '@/hooks/useClienteEmDia'

type Classification = 'antecipado' | 'vencimento' | 'atraso' | 'indefinido'

interface DashboardRow extends DashboardHistoryRow {
  deltaVencimento: number | null
  classificacao: Classification
}

function formatPoints(value: number): string {
  return value.toLocaleString('pt-BR')
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = toLocalDate(value)
  if (!date) return '—'
  return date.toLocaleDateString('pt-BR')
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function toLocalDate(value?: string | null): Date | null {
  if (!value) return null
  const fromNative = new Date(value)
  if (!Number.isNaN(fromNative.getTime())) {
    return new Date(fromNative.getFullYear(), fromNative.getMonth(), fromNative.getDate())
  }

  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!dateOnly) return null

  const y = Number(dateOnly[1])
  const m = Number(dateOnly[2]) - 1
  const d = Number(dateOnly[3])
  const fallback = new Date(y, m, d)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function getDeltaVencimento(pagamento: string | null, vencimento: string | null): number | null {
  const paymentDate = toLocalDate(pagamento)
  const dueDate = toLocalDate(vencimento)
  if (!paymentDate || !dueDate) return null
  return Math.round((dueDate.getTime() - paymentDate.getTime()) / 86_400_000)
}

function classifyByDates(delta: number | null): Classification {
  if (delta === null) return 'indefinido'
  if (delta > 0) return 'antecipado'
  if (delta === 0) return 'vencimento'
  return 'atraso'
}

function classificationLabel(value: Classification): string {
  if (value === 'antecipado') return 'Pagamento antecipado'
  if (value === 'vencimento') return 'Pagamento no vencimento'
  if (value === 'atraso') return 'Pagamento após o vencimento'
  return 'Classificação indisponível'
}

function formatDelta(delta: number | null): string {
  if (delta === null) return '—'
  if (delta > 0) return `+${delta}`
  return `${delta}`
}

function monthDateRange(): { from: string; to: string; label: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const from = first.toISOString().slice(0, 10)
  const to = last.toISOString().slice(0, 10)
  return { from, to, label: 'Mês atual' }
}

function ScoreSummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Zap
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold text-foreground">{formatPoints(value)}</p>
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [metrics, setMetrics] = useState({
    totalPoints: 0,
    redemptionsCount: 0,
    redeemedPoints: 0,
  })
  const [rows, setRows] = useState<DashboardRow[]>([])
  const [summary, setSummary] = useState({
    antecipado: 0,
    vencimento: 0,
    atraso: 0,
  })
  const [searchType, setSearchType] = useState<HeaderSearchType>('name')
  const [searchQuery, setSearchQuery] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const { rewards, overview } = useClienteEmDia()

  const period = useMemo(() => monthDateRange(), [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const tenantId = await getCurrentTenantId()
      if (!tenantId) {
        setError('Usuário não associado a um tenant. Faça login novamente.')
        return
      }

      const [metricData, fullPeriodRows, latestRows] = await Promise.all([
        fetchDashboardMetrics({ tenantId, dateFrom: period.from, dateTo: period.to }),
        fetchDashboardHistory({ tenantId, dateFrom: period.from, dateTo: period.to, limit: 10000 }),
        fetchDashboardHistory({
          tenantId,
          dateFrom: period.from,
          dateTo: period.to,
          limit: 8,
          searchType,
          searchQuery,
        }),
      ])

      const classifiedFull = fullPeriodRows.map((row) => {
        const delta = getDeltaVencimento(row.data_pagamento, row.data_vencimento)
        const classificacao = classifyByDates(delta)
        return { ...row, deltaVencimento: delta, classificacao }
      })

      const classifiedLatest = latestRows.map((row) => {
        const delta = getDeltaVencimento(row.data_pagamento, row.data_vencimento)
        const classificacao = classifyByDates(delta)
        return { ...row, deltaVencimento: delta, classificacao }
      })

      setMetrics(metricData)
      setRows(classifiedLatest)
      setSummary({
        antecipado: classifiedFull
          .filter((r) => r.classificacao === 'antecipado')
          .reduce((sum, row) => sum + Number(row.pontos_gerados || 0), 0),
        vencimento: classifiedFull
          .filter((r) => r.classificacao === 'vencimento')
          .reduce((sum, row) => sum + Number(row.pontos_gerados || 0), 0),
        atraso: classifiedFull
          .filter((r) => r.classificacao === 'atraso')
          .reduce((sum, row) => sum + Number(row.pontos_gerados || 0), 0),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados do dashboard.')
    } finally {
      setLoading(false)
    }
  }, [period.from, period.to, searchType, searchQuery])

  const [throttledFetch, refreshBusy] = useThrottledAction(fetchData)

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ searchType: HeaderSearchType; query: string }>).detail
      if (!detail) return
      setSearchType(detail.searchType)
      setSearchQuery(detail.query ?? '')
    }

    window.addEventListener(DASHBOARD_CLIENT_SEARCH_EVENT, handler)
    return () => window.removeEventListener(DASHBOARD_CLIENT_SEARCH_EVENT, handler)
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    void fetchCurrentUserProfile()
      .then((profile) => setIsAdmin(isAdminUiRole(profile.role)))
      .catch(() => setIsAdmin(false))
  }, [])

  return (
    <ProtectedRoute>
      <Layout>
        <PageHeader
          icon={LayoutDashboard}
          title="Operação"
          subtitle="Acesso rápido para clientes, catálogo, resgates e histórico da empresa atual."
          actions={
            <Button variant="outline" size="sm" disabled={refreshBusy} onClick={() => void throttledFetch()}>
              <RefreshCw className={`h-3.5 w-3.5 transition-transform ${refreshBusy ? 'animate-spin' : ''}`} />
              {refreshBusy ? 'Atualizando…' : 'Atualizar'}
            </Button>
          }
        />

        <div className="page-stack">
          <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[linear-gradient(135deg,hsl(var(--success)/0.08),transparent_55%),hsl(var(--surface-1))] p-5 lg:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--success))]">Fluxo diário</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">Tudo o que a operação mais usa, sem entrar em telas administrativas.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Consulte clientes, acompanhe pontos, veja o catálogo disponível e processe resgates em menos cliques.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Button asChild variant="outline" className="justify-between">
                  <Link to="/clients">
                    Clientes
                    <Users className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-between">
                  <Link to="/catalogo">
                    Catálogo
                    <Gift className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-between">
                  <Link to="/resgates">
                    Resgates
                    <Ticket className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-between">
                  <Link to="/receivables">
                    Histórico
                    <ShoppingBag className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Building2 className="h-4 w-4 text-primary" />
                Escopo da empresa
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Clientes visíveis</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{overview.length.toLocaleString('pt-BR')}</p>
                </div>
                <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Recompensas disponíveis</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{rewards.filter((reward) => reward.ativo).length.toLocaleString('pt-BR')}</p>
                </div>
                {isAdmin && (
                  <Button asChild className="w-full">
                    <Link to="/admin/empresa">
                      Administração da empresa
                      <Settings2 className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-3 [&>*]:h-full">
            <StatCard
              label="Pontuação geral acumulada"
              value={formatPoints(metrics.totalPoints)}
              helper={period.label}
              icon={Coins}
              iconColor="text-[hsl(var(--success))]"
              iconBg="bg-[hsl(var(--success)/0.1)]"
            />
            <StatCard
              label="Resgates no período"
              value={formatPoints(metrics.redemptionsCount)}
              helper={period.label}
              icon={Wallet}
              iconColor="text-[hsl(var(--warning))]"
              iconBg="bg-[hsl(var(--warning)/0.1)]"
            />
            <StatCard
              label="Pontos resgatados no período"
              value={formatPoints(metrics.redeemedPoints)}
              helper={period.label}
              icon={Zap}
              iconColor="text-primary"
              iconBg="bg-primary/10"
            />
          </div>

          <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]">
            <div className="flex flex-col gap-3 border-b border-[hsl(var(--border))] p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">Últimos registros de pontuação</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  Histórico recente de pontuação gerada no período selecionado.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full sm:w-fit">
                <Link to="/receivables">
                  Ver todos
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Spinner size="md" />
              </div>
            ) : error ? (
              <div className="p-5">
                <AlertBanner variant="error" message={error} actionLabel="Tentar novamente" onAction={() => void fetchData()} />
              </div>
            ) : (
              <>
                <div className="grid gap-3 border-b border-[hsl(var(--border))] px-5 py-4 sm:grid-cols-3 lg:px-6">
                  <ScoreSummaryCard icon={Zap} label="Pagamentos antecipados" value={summary.antecipado} color="bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]" />
                  <ScoreSummaryCard icon={CalendarCheck} label="Pagamentos no vencimento" value={summary.vencimento} color="bg-primary/10 text-primary" />
                  <ScoreSummaryCard icon={Clock} label="Pagamentos após o vencimento" value={summary.atraso} color="bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]" />
                </div>

                {rows.length === 0 ? (
                  <div className="p-5">
                    <EmptyState icon={<Coins className="h-5 w-5" />} title="Nenhum registro" description="Não há registros de pontuação para o período e filtros atuais." />
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-[hsl(var(--border))] md:hidden">
                      {rows.map((item) => (
                        <Link key={item.id} to={`/receivables/${item.id}`} className="block px-5 py-3.5 transition-colors hover:bg-[hsl(var(--muted))]">
                          <p className="truncate text-sm font-medium text-foreground">{item.cliente_nome?.trim() || `Cliente #${item.ixc_cliente_id}`}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {classificationLabel(item.classificacao)} · {formatDelta(item.deltaVencimento)} · +{formatPoints(item.pontos_gerados)} pts
                          </p>
                        </Link>
                      ))}
                    </div>

                    <div className="table-responsive hidden md:block">
                      <table className="w-full min-w-[52rem] text-sm">
                        <thead>
                          <tr className="border-b border-[hsl(var(--border))]">
                            <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground lg:px-6">Cliente</th>
                            <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Classificação</th>
                            <th className="px-3 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pontos</th>
                            <th className="px-3 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Δ vencimento</th>
                            <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Vencimento</th>
                            <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pago em</th>
                            <th className="px-3 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Valor pago</th>
                            <th className="px-5 py-3 lg:px-6"><span className="sr-only">Ações</span></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[hsl(var(--border))]">
                          {rows.map((item) => (
                            <tr key={item.id} className="transition-colors hover:bg-[hsl(var(--muted))]">
                              <td className="px-5 py-3 lg:px-6">
                                <p className="font-medium text-foreground">{item.cliente_nome?.trim() || `Cliente #${item.ixc_cliente_id}`}</p>
                                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">#{item.ixc_cliente_id}</p>
                              </td>
                              <td className="px-3 py-3">{categoryBadge(classificationLabel(item.classificacao))}</td>
                              <td className="px-3 py-3 text-center font-semibold text-foreground">+{formatPoints(item.pontos_gerados)}</td>
                              <td className="px-3 py-3 text-center font-mono text-xs text-muted-foreground">{formatDelta(item.deltaVencimento)}</td>
                              <td className="px-3 py-3 text-muted-foreground">{formatDate(item.data_vencimento)}</td>
                              <td className="px-3 py-3 text-muted-foreground">{formatDate(item.data_pagamento)}</td>
                              <td className="px-3 py-3 text-right font-medium text-[hsl(var(--success))]">{formatBRL(item.valor_pago)}</td>
                              <td className="px-5 py-3 text-right lg:px-6">
                                <Link to={`/receivables/${item.id}`} className="inline-flex items-center gap-1 text-[13px] text-primary transition-colors hover:text-primary/80">
                                  Detalhe
                                  <ArrowRight className="h-3 w-3" />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
