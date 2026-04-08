import { useCallback, useEffect, useMemo, useState } from 'react'
import { useThrottledAction } from '@/hooks/useThrottledAction'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Coins,
  LayoutDashboard,
  RefreshCw,
  Wallet,
  Zap,
  Clock,
  CalendarCheck,
} from 'lucide-react'
import Layout, { DASHBOARD_CLIENT_SEARCH_EVENT, type DashboardSearchType as HeaderSearchType } from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
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
  if (value === 'antecipado') return 'Antecipado'
  if (value === 'vencimento') return 'No vencimento'
  if (value === 'atraso') return 'Após vencimento'
  return '—'
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

  return (
    <ProtectedRoute>
      <Layout>
        <div className="page-stack">
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-3 [&>*]:h-full">
            <StatCard
              label="Pontos acumulados"
              value={formatPoints(metrics.totalPoints)}
              helper={period.label}
              icon={Coins}
              iconColor="text-[hsl(var(--success))]"
              iconBg="bg-[hsl(var(--success)/0.1)]"
            />
            <StatCard
              label="Resgates realizados"
              value={formatPoints(metrics.redemptionsCount)}
              helper={period.label}
              icon={Wallet}
              iconColor="text-[hsl(var(--warning))]"
              iconBg="bg-[hsl(var(--warning)/0.1)]"
            />
            <StatCard
              label="Pontos resgatados"
              value={formatPoints(metrics.redeemedPoints)}
              helper={period.label}
              icon={Zap}
              iconColor="text-primary"
              iconBg="bg-primary/10"
            />
          </div>

          {/* Summary chips */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]">
                <Zap className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-semibold text-foreground">{formatPoints(summary.antecipado)}</p>
                <p className="truncate text-[11px] text-muted-foreground">Antecipados</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarCheck className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-semibold text-foreground">{formatPoints(summary.vencimento)}</p>
                <p className="truncate text-[11px] text-muted-foreground">No vencimento</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-semibold text-foreground">{formatPoints(summary.atraso)}</p>
                <p className="truncate text-[11px] text-muted-foreground">Após vencimento</p>
              </div>
            </div>
          </div>

          {/* Recent history table */}
          <section className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Últimos registros</h2>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" disabled={refreshBusy} onClick={() => void throttledFetch()}>
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshBusy ? 'animate-spin' : ''}`} />
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/receivables">
                    Ver todos
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner size="md" />
              </div>
            ) : error ? (
              <div className="p-5">
                <AlertBanner variant="error" message={error} actionLabel="Tentar novamente" onAction={() => void fetchData()} />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={<Coins className="h-5 w-5" />} title="Nenhum registro" description="Não há registros de pontuação para este período." />
              </div>
            ) : (
              <>
                {/* Mobile list */}
                <div className="divide-y divide-border md:hidden">
                  {rows.map((item) => (
                    <Link key={item.id} to={`/receivables/${item.id}`} className="block px-5 py-3.5 transition-colors hover:bg-muted">
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-medium text-foreground">{item.cliente_nome?.trim() || `#${item.ixc_cliente_id}`}</p>
                        <span className="ml-2 text-xs font-semibold text-[hsl(var(--success))]">+{formatPoints(item.pontos_gerados)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {classificationLabel(item.classificacao)} · {formatDate(item.data_pagamento)}
                      </p>
                    </Link>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="table-responsive hidden md:block">
                  <table className="w-full min-w-[48rem] text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Cliente</th>
                        <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Classificação</th>
                        <th className="px-3 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pontos</th>
                        <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Vencimento</th>
                        <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pago em</th>
                        <th className="px-3 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((item) => (
                        <tr key={item.id} className="transition-colors hover:bg-muted">
                          <td className="px-5 py-3">
                            <Link to={`/receivables/${item.id}`} className="font-medium text-foreground hover:text-primary">
                              {item.cliente_nome?.trim() || `#${item.ixc_cliente_id}`}
                            </Link>
                          </td>
                          <td className="px-3 py-3">{categoryBadge(item.classificacao)}</td>
                          <td className="px-3 py-3 text-center font-semibold text-[hsl(var(--success))]">+{formatPoints(item.pontos_gerados)}</td>
                          <td className="px-3 py-3 text-muted-foreground">{formatDate(item.data_vencimento)}</td>
                          <td className="px-3 py-3 text-muted-foreground">{formatDate(item.data_pagamento)}</td>
                          <td className="px-3 py-3 text-right text-muted-foreground">{formatBRL(Number(item.valor_pago ?? 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
