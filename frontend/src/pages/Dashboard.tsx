import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Coins,
  LayoutDashboard,
  RefreshCw,
  TrendingUp,
  Wallet,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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

export default function DashboardPage() {
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [totalReceived, setTotalReceived] = useState(0)
  const [totalRenegotiated, setTotalRenegotiated] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)

  const scoreSummary = {
    fivePoints: receivables.filter((item) => getPaymentScore(item) === 5).length,
    fourPoints: receivables.filter((item) => getPaymentScore(item) === 4).length,
    twoPoints: receivables.filter((item) => getPaymentScore(item) === 2).length,
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
          {/* Stats */}
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

          {/* Recent table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Últimos pagamentos pontuados</CardTitle>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Pagamentos recentes já classificados conforme a regra da campanha.
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/receivables">
                  Ver todos
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
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
                  {/* Score summary */}
                  <div className="grid gap-3 border-b border-white/[0.04] px-5 py-4 md:grid-cols-3">
                    {[
                      { label: '5 pontos', helper: 'Pagamentos antecipados', value: scoreSummary.fivePoints, color: 'text-[hsl(var(--success))]' },
                      { label: '4 pontos', helper: 'Pagamentos no vencimento', value: scoreSummary.fourPoints, color: 'text-primary' },
                      { label: '2 pontos', helper: 'Pagamentos após o vencimento', value: scoreSummary.twoPoints, color: 'text-[hsl(var(--warning))]' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{item.label}</p>
                        <p className={`mt-2 text-2xl font-semibold ${item.color}`}>{formatCount(item.value)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.helper}</p>
                      </div>
                    ))}
                  </div>

                  {/* Mobile cards */}
                  <div className="grid gap-2 p-4 md:hidden">
                    {receivables.map((item) => (
                      <Link
                        key={item.id}
                        to={`/receivables/${item.id}`}
                        className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4 transition-all duration-200 hover:bg-white/[0.03] hover:border-white/[0.08]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{formatClientName(item)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {getPaymentBehaviorLabel(item)} • #{item.id}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pontos</p>
                              <p className="text-sm font-semibold text-[hsl(var(--success))]">+{getPaymentScore(item)}</p>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Vencimento</p>
                            <p className="mt-0.5 text-foreground">{formatDate(item.data_vencimento)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pago em</p>
                            <p className="mt-0.5 text-foreground">{formatDate(item.data_pagamento ?? '')}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor pago</p>
                            <p className="mt-0.5 font-medium text-[hsl(var(--success))]">{formatBRL(item.valor_recebido)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Faixa</p>
                            <div className="mt-0.5">{categoryBadge(getPaymentBehaviorLabel(item))}</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Evento</TableHead>
                          <TableHead className="text-right">Pontos</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Pago em</TableHead>
                          <TableHead className="text-right">Valor pago</TableHead>
                          <TableHead className="text-right" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {receivables.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground">{formatClientName(item)}</p>
                                <p className="mt-0.5 font-mono text-xs text-muted-foreground">#{item.id}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{getPaymentBehaviorLabel(item)}</TableCell>
                            <TableCell className="text-right font-semibold text-[hsl(var(--success))]">
                              +{getPaymentScore(item)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(item.data_vencimento)}</TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(item.data_pagamento ?? '')}</TableCell>
                            <TableCell className="text-right text-[hsl(var(--success))]">{formatBRL(item.valor_recebido)}</TableCell>
                            <TableCell className="text-right">
                              <Link to={`/receivables/${item.id}`} className="text-sm text-primary transition-colors hover:text-primary/80">
                                Detalhe
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
