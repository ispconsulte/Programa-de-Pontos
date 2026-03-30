import { useCallback, useEffect, useState } from 'react'
import { useThrottledAction } from '@/hooks/useThrottledAction'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Coins,
  LayoutDashboard,
  RefreshCw,
  TrendingUp,
  Wallet,
  Zap,
  Clock,
  CalendarCheck,
} from 'lucide-react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import StatCard from '@/components/StatCard'
import AlertBanner from '@/components/AlertBanner'
import Spinner from '@/components/Spinner'
import EmptyState from '@/components/EmptyState'
import { categoryBadge } from '@/components/Badge'
import { apiFetch, getApiErrorMessage, getDisplayError } from '@/lib/api-client'
import { getPaymentBehaviorLabel, getPaymentScore } from '@/lib/receivables-utils'
import { Button } from '@/components/ui/button'

/* ── Types ── */
interface Receivable {
  id: string | number
  id_cliente: string | number
  cliente_nome?: string | null
  data_vencimento: string
  data_pagamento?: string | null
  valor: string | number
  valor_recebido: string | number
  categoria: string
  categoria_codigo?: string
}

interface ReceivablesResponse {
  data: Receivable[]
  total?: number
  page?: number
  limit?: number
  summary?: {
    totalReceived?: number
    totalRenegotiated?: number
    totalAmount?: string | number
  }
}

/* ── Helpers ── */
function formatBRL(value: string | number | undefined): string {
  if (value === undefined || value === null) return 'R$ 0,00'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return 'R$ 0,00'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('pt-BR')
}

function formatCount(value: number): string {
  return value.toLocaleString('pt-BR')
}

function formatClientName(receivable: Receivable): string {
  const name = receivable.cliente_nome?.trim()
  if (name) return name
  return `Cliente #${receivable.id_cliente}`
}

/* ── Score pill component ── */
function ScorePill({ score }: { score: number }) {
  const colors =
    score >= 5
      ? 'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]'
      : score >= 4
        ? 'bg-primary/10 text-primary'
        : 'bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))]'

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${colors}`}>
      +{score}
    </span>
  )
}

/* ── Score summary mini-card ── */
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
    <div className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-4 py-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold text-foreground">{formatCount(value)}</p>
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

/* ── Page ── */
export default function DashboardPage() {
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [totalReceived, setTotalReceived] = useState(0)
  const [totalRenegotiated, setTotalRenegotiated] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)

  const scoreSummary = {
    five: receivables.filter((r) => getPaymentScore(r) === 5).length,
    four: receivables.filter((r) => getPaymentScore(r) === 4).length,
    two: receivables.filter((r) => getPaymentScore(r) === 2).length,
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/receivables?page=1&limit=8')
      if (!res.ok) {
        setError(await getApiErrorMessage(res, 'Erro ao carregar dados.'))
        return
      }
      const json: ReceivablesResponse = await res.json()
      const items = json.data || []
      const summary = json.summary
      setReceivables(items)
      setTotalReceived(Number(summary?.totalReceived || 0))
      setTotalRenegotiated(Number(summary?.totalRenegotiated || 0))
      setTotalAmount(Number(summary?.totalAmount || 0))
    } catch (err) {
      setError(getDisplayError(err, 'Erro ao carregar dados.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <ProtectedRoute>
      <Layout>
        <PageHeader
          icon={LayoutDashboard}
          title="Painel"
          subtitle="Visão geral da operação"
          actions={
            <Button variant="outline" size="sm" onClick={() => void fetchData()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
          }
        />

        <div className="page-stack">
          {/* ── Top stat cards ── */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Recebimentos pagos"
              value={formatCount(totalReceived)}
              icon={Coins}
              iconColor="text-[hsl(var(--success))]"
              iconBg="bg-[hsl(var(--success)/0.1)]"
            />
            <StatCard
              label="Renegociações"
              value={formatCount(totalRenegotiated)}
              icon={Wallet}
              iconColor="text-[hsl(var(--warning))]"
              iconBg="bg-[hsl(var(--warning)/0.1)]"
            />
            <StatCard
              label="Volume total"
              value={formatBRL(totalAmount)}
              icon={TrendingUp}
              iconColor="text-primary"
              iconBg="bg-primary/10"
            />
          </div>

          {/* ── Recent payments section ── */}
          <section className="rounded-xl border border-white/[0.06] bg-[hsl(var(--surface-1))]">
            {/* Section header */}
            <div className="flex flex-col gap-3 border-b border-white/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Últimos pagamentos pontuados</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  Pagamentos recentes classificados conforme a regra da campanha.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="w-fit">
                <Link to="/receivables">
                  Ver todos
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {/* Content area */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Spinner size="md" />
              </div>
            ) : error ? (
              <div className="p-5">
                <AlertBanner variant="error" message={error} actionLabel="Tentar novamente" onAction={() => void fetchData()} />
              </div>
            ) : receivables.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={<Coins className="h-5 w-5" />} title="Nenhum recebimento" description="Nenhum recebimento encontrado ainda." />
              </div>
            ) : (
              <>
                {/* Score distribution strip */}
                <div className="grid gap-3 border-b border-white/[0.04] px-5 py-4 sm:grid-cols-3 lg:px-6">
                  <ScoreSummaryCard
                    icon={Zap}
                    label="Pagamentos antecipados"
                    value={scoreSummary.five}
                    color="bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]"
                  />
                  <ScoreSummaryCard
                    icon={CalendarCheck}
                    label="Pagamentos no vencimento"
                    value={scoreSummary.four}
                    color="bg-primary/10 text-primary"
                  />
                  <ScoreSummaryCard
                    icon={Clock}
                    label="Pagamentos após o vencimento"
                    value={scoreSummary.two}
                    color="bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]"
                  />
                </div>

                {/* ── Mobile list ── */}
                <div className="divide-y divide-white/[0.04] md:hidden">
                  {receivables.map((item) => (
                    <Link
                      key={item.id}
                      to={`/receivables/${item.id}`}
                      className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.02]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{formatClientName(item)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(item.data_vencimento)} · {formatBRL(item.valor_recebido)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <ScorePill score={getPaymentScore(item)} />
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                      </div>
                    </Link>
                  ))}
                </div>

                {/* ── Desktop table ── */}
                <div className="hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.04]">
                        <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground lg:px-6">Cliente</th>
                        <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Classificação</th>
                        <th className="px-3 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pontos</th>
                        <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Vencimento</th>
                        <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pago em</th>
                        <th className="px-3 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Valor pago</th>
                        <th className="px-5 py-3 lg:px-6"><span className="sr-only">Ações</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {receivables.map((item) => (
                        <tr key={item.id} className="transition-colors hover:bg-white/[0.015]">
                          <td className="px-5 py-3.5 lg:px-6">
                            <p className="font-medium text-foreground">{formatClientName(item)}</p>
                            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">#{item.id}</p>
                          </td>
                          <td className="px-3 py-3.5">
                            {categoryBadge(getPaymentBehaviorLabel(item))}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <ScorePill score={getPaymentScore(item)} />
                          </td>
                          <td className="px-3 py-3.5 text-muted-foreground">{formatDate(item.data_vencimento)}</td>
                          <td className="px-3 py-3.5 text-muted-foreground">{formatDate(item.data_pagamento ?? '')}</td>
                          <td className="px-3 py-3.5 text-right font-medium text-[hsl(var(--success))]">{formatBRL(item.valor_recebido)}</td>
                          <td className="px-5 py-3.5 text-right lg:px-6">
                            <Link
                              to={`/receivables/${item.id}`}
                              className="inline-flex items-center gap-1 text-[13px] text-primary transition-colors hover:text-primary/80"
                            >
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
          </section>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
