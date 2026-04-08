import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useThrottledAction } from '@/hooks/useThrottledAction'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Coins,
  RefreshCw,
  Wallet,
  Zap,
  Clock,
  CalendarCheck,
} from 'lucide-react'
import Layout, { DASHBOARD_CLIENT_SEARCH_EVENT, type DashboardSearchType as HeaderSearchType } from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
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

function monthDateRange(): { from: string; to: string; label: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const from = first.toISOString().slice(0, 10)
  const to = last.toISOString().slice(0, 10)
  return { from, to, label: 'Mês atual' }
}

/* ── Avatar colors by initial ─────────────────────────────────────────── */
const avatarColors = [
  'bg-emerald-500/15 text-emerald-500',
  'bg-sky-500/15 text-sky-500',
  'bg-amber-500/15 text-amber-500',
  'bg-rose-500/15 text-rose-500',
  'bg-violet-500/15 text-violet-500',
  'bg-teal-500/15 text-teal-500',
]
function avatarColor(name: string): string {
  const code = (name || '#').charCodeAt(0)
  return avatarColors[code % avatarColors.length]
}

/* ── Classification row accent ────────────────────────────────────────── */
function classificationAccent(c: Classification): string {
  if (c === 'antecipado') return 'border-l-emerald-500'
  if (c === 'atraso') return 'border-l-rose-500'
  if (c === 'vencimento') return 'border-l-sky-500'
  return 'border-l-transparent'
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
  const [showCalmModal, setShowCalmModal] = useState(false)
  const clickCountRef = useRef(0)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        return { ...row, deltaVencimento: delta, classificacao: classifyByDates(delta) }
      })

      const classifiedLatest = latestRows.map((row) => {
        const delta = getDeltaVencimento(row.data_pagamento, row.data_vencimento)
        return { ...row, deltaVencimento: delta, classificacao: classifyByDates(delta) }
      })

      setMetrics(metricData)
      setRows(classifiedLatest)
      setSummary({
        antecipado: classifiedFull.filter((r) => r.classificacao === 'antecipado').reduce((s, r) => s + Number(r.pontos_gerados || 0), 0),
        vencimento: classifiedFull.filter((r) => r.classificacao === 'vencimento').reduce((s, r) => s + Number(r.pontos_gerados || 0), 0),
        atraso: classifiedFull.filter((r) => r.classificacao === 'atraso').reduce((s, r) => s + Number(r.pontos_gerados || 0), 0),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados do dashboard.')
    } finally {
      setLoading(false)
    }
  }, [period.from, period.to, searchType, searchQuery])

  const [throttledFetch, refreshBusy] = useThrottledAction(fetchData)

  const handleRefresh = () => {
    clickCountRef.current += 1
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    clickTimerRef.current = setTimeout(() => { clickCountRef.current = 0 }, 4000)
    if (clickCountRef.current >= 3) {
      setShowCalmModal(true)
      clickCountRef.current = 0
      return
    }
    void throttledFetch()
  }

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

  useEffect(() => { void fetchData() }, [fetchData])

  return (
    <ProtectedRoute>
      <Layout>
        <div className="page-stack">
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              label="Pontos acumulados"
              value={formatPoints(metrics.totalPoints)}
              helper={period.label}
              icon={Coins}
              gradient="from-emerald-500/10 to-emerald-500/[0.02]"
              iconClass="bg-emerald-500/15 text-emerald-500"
            />
            <KpiCard
              label="Resgates realizados"
              value={formatPoints(metrics.redemptionsCount)}
              helper={period.label}
              icon={Wallet}
              gradient="from-amber-500/10 to-amber-500/[0.02]"
              iconClass="bg-amber-500/15 text-amber-500"
            />
            <KpiCard
              label="Pontos resgatados"
              value={formatPoints(metrics.redeemedPoints)}
              helper={period.label}
              icon={Zap}
              gradient="from-primary/10 to-primary/[0.02]"
              iconClass="bg-primary/15 text-primary"
            />
          </div>

          {/* Summary chips */}
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryChip icon={Zap} value={formatPoints(summary.antecipado)} label="Antecipados" color="emerald" />
            <SummaryChip icon={CalendarCheck} value={formatPoints(summary.vencimento)} label="No vencimento" color="sky" />
            <SummaryChip icon={Clock} value={formatPoints(summary.atraso)} label="Após vencimento" color="rose" />
          </div>

          {/* Recent history */}
          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-bold text-foreground">Últimos registros</h2>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={refreshBusy} onClick={handleRefresh}>
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshBusy ? 'animate-spin' : ''}`} />
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/receivables">Ver todos <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16"><Spinner size="md" /></div>
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
                {/* Mobile */}
                <div className="divide-y divide-border md:hidden">
                  {rows.map((item) => (
                    <Link
                      key={item.id}
                      to={`/receivables/${item.id}`}
                      className={`flex items-center gap-3 border-l-[3px] px-4 py-3.5 transition-colors hover:bg-muted/60 ${classificationAccent(item.classificacao)}`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(item.cliente_nome || '#')}`}>
                        {(item.cliente_nome?.trim()?.[0] || '#').toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{item.cliente_nome?.trim() || `#${item.ixc_cliente_id}`}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {classificationLabel(item.classificacao)} · {formatDate(item.data_pagamento)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-[hsl(var(--success))]">+{formatPoints(item.pontos_gerados)}</p>
                        <p className="text-[10px] text-muted-foreground">{formatBRL(Number(item.valor_pago ?? 0))}</p>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Desktop */}
                <div className="hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cliente</th>
                        <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Classificação</th>
                        <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pontos</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Vencimento</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pago em</th>
                        <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {rows.map((item) => (
                        <tr key={item.id} className={`group border-l-[3px] transition-colors hover:bg-muted/40 ${classificationAccent(item.classificacao)}`}>
                          <td className="px-5 py-3.5">
                            <Link to={`/clients/${item.ixc_cliente_id}`} className="flex items-center gap-3">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${avatarColor(item.cliente_nome || '#')}`}>
                                {(item.cliente_nome?.trim()?.[0] || '#').toUpperCase()}
                              </div>
                              <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                                {item.cliente_nome?.trim() || `#${item.ixc_cliente_id}`}
                              </span>
                            </Link>
                          </td>
                          <td className="px-3 py-3.5 text-center">{categoryBadge(item.classificacao)}</td>
                          <td className="px-3 py-3.5 text-center">
                            <span className="inline-flex items-center rounded-md bg-[hsl(var(--success)/0.1)] px-2 py-0.5 text-xs font-bold text-[hsl(var(--success))]">
                              +{formatPoints(item.pontos_gerados)}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 text-muted-foreground">{formatDate(item.data_vencimento)}</td>
                          <td className="px-3 py-3.5 text-muted-foreground">{formatDate(item.data_pagamento)}</td>
                          <td className="px-5 py-3.5 text-right font-semibold text-foreground">{formatBRL(Number(item.valor_pago ?? 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>

        {/* Anti-spam modal */}
        {showCalmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCalmModal(false)}>
            <div className="mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <RefreshCw className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Calma! 😊</h3>
              <p className="mt-2 text-sm text-muted-foreground">Seus dados estão sendo atualizados. Não é necessário ter pressa.</p>
              <Button className="mt-5 w-full" onClick={() => setShowCalmModal(false)}>Entendi</Button>
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  )
}

/* ── Sub-components ───────────────────────────────────────────────────── */

function KpiCard({ label, value, helper, icon: Icon, gradient, iconClass }: {
  label: string; value: string; helper: string
  icon: React.ElementType; gradient: string; iconClass: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-border bg-gradient-to-br ${gradient} p-5`}>
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  )
}

function SummaryChip({ icon: Icon, value, label, color }: {
  icon: React.ElementType; value: string; label: string
  color: 'emerald' | 'sky' | 'rose'
}) {
  const styles = {
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    sky: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    rose: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  }
  const iconBg = {
    emerald: 'bg-emerald-500/15 text-emerald-500',
    sky: 'bg-sky-500/15 text-sky-500',
    rose: 'bg-rose-500/15 text-rose-500',
  }
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${styles[color]}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg[color]}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold">{value}</p>
        <p className="truncate text-[11px] opacity-70">{label}</p>
      </div>
    </div>
  )
}
