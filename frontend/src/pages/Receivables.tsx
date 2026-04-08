import { useEffect, useState, useCallback } from 'react'
import { useThrottledAction } from '@/hooks/useThrottledAction'
import { Link } from 'react-router-dom'
import { ArrowRight, Users, RefreshCw, Search, ShieldAlert, TrendingUp, Award, Clock } from 'lucide-react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import { statusBadge } from '@/components/Badge'
import Pagination from '@/components/Pagination'
import { getPaymentBehaviorLabel, getPaymentScore, toNumber } from '@/lib/receivables-utils'
import { fetchReceivables, fetchClientNamesByIxcIds, getCurrentTenantId, type ReceivableRow } from '@/lib/supabase-queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/* ── Adapter: DB row → UI shape ── */
function toShape(row: ReceivableRow, nameMap?: Map<string, string>) {
  const payload = (row.payload ?? {}) as Record<string, unknown>
  return {
    id: row.id,
    id_cliente: row.ixc_cliente_id,
    cliente_nome: nameMap?.get(row.ixc_cliente_id) ?? null,
    data_vencimento: (payload.competencia as string | undefined) ?? row.competencia ?? '',
    data_pagamento: row.data_pagamento ?? null,
    valor: row.valor_pago ?? 0,
    valor_recebido: row.valor_pago ?? 0,
    status: row.status_processamento,
    categoria: row.status_processamento,
    categoria_codigo: row.status_processamento,
    pontos_gerados: row.pontos_gerados,
  }
}

type Receivable = ReturnType<typeof toShape>

interface AppliedFilters {
  category: string
  dateFrom: string
  dateTo: string
}

type SortOption = 'due_desc' | 'due_asc' | 'payment_desc' | 'payment_asc' | 'received_desc' | 'received_asc' | 'points_desc' | 'points_asc'

function formatBRL(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr === '0000-00-00' || dateStr === '0000-00-00 00:00:00') return '-'
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('pt-BR')
}

function formatText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  const text = String(value).trim()
  if (!text || text === '-' || text.toLowerCase() === 'undefined' || text.toLowerCase() === 'null') return '-'
  return text
}

function formatClientLabel(receivable: Receivable): string {
  const name = receivable.cliente_nome?.trim()
  if (name) return name
  return `Cliente #${receivable.id_cliente}`
}

const CATEGORIES = [
  { value: 'all', label: 'Todas' },
  { value: 'processado', label: 'Processado' },
  { value: 'ignorado', label: 'Ignorado' },
  { value: 'erro', label: 'Erro' },
]

const PAGE_SIZES = [10, 25, 50]
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'due_desc', label: 'Vencimento mais recente' },
  { value: 'due_asc', label: 'Vencimento mais antigo' },
  { value: 'payment_desc', label: 'Pagamento mais recente' },
  { value: 'payment_asc', label: 'Pagamento mais antigo' },
  { value: 'received_desc', label: 'Maior valor recebido' },
  { value: 'received_asc', label: 'Menor valor recebido' },
  { value: 'points_desc', label: 'Maior pontuação' },
  { value: 'points_asc', label: 'Menor pontuação' },
]

function toComparableDate(value?: string | null) {
  if (!value || value === '0000-00-00' || value === '0000-00-00 00:00:00') return 0
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function sortReceivables(items: Receivable[], sortBy: SortOption) {
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case 'due_asc': return toComparableDate(a.data_vencimento) - toComparableDate(b.data_vencimento)
      case 'due_desc': return toComparableDate(b.data_vencimento) - toComparableDate(a.data_vencimento)
      case 'payment_asc': return toComparableDate(a.data_pagamento) - toComparableDate(b.data_pagamento)
      case 'payment_desc': return toComparableDate(b.data_pagamento) - toComparableDate(a.data_pagamento)
      case 'received_asc': return (toNumber(a.valor_recebido) ?? 0) - (toNumber(b.valor_recebido) ?? 0)
      case 'received_desc': return (toNumber(b.valor_recebido) ?? 0) - (toNumber(a.valor_recebido) ?? 0)
      case 'points_asc': return getPaymentScore(a) - getPaymentScore(b)
      case 'points_desc': return getPaymentScore(b) - getPaymentScore(a)
      default: return 0
    }
  })
}

/** Color for score-based badge */
function scoreBadge(score: number) {
  if (score === 5) return <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/20">+5 pts</span>
  if (score === 4) return <span className="inline-flex items-center rounded-md bg-sky-500/10 px-2 py-0.5 text-xs font-semibold text-sky-400 ring-1 ring-inset ring-sky-500/20">+4 pts</span>
  if (score === 2) return <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/20">+2 pts</span>
  return <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">0 pts</span>
}

export default function ReceivablesPage() {
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [category, setCategory] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({ category: 'all', dateFrom: '', dateTo: '' })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('due_desc')
  const [clientNameMap, setClientNameMap] = useState<Map<string, string>>(new Map())
  const [uniqueClients, setUniqueClients] = useState(0)

  const fetchReceivablesData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const tenantId = await getCurrentTenantId()
      if (!tenantId) {
        setError('Usuário não associado a um tenant.')
        return
      }

      const result = await fetchReceivables({
        tenantId,
        page,
        limit,
        category: appliedFilters.category !== 'all' ? appliedFilters.category : undefined,
        dateFrom: appliedFilters.dateFrom || undefined,
        dateTo: appliedFilters.dateTo || undefined,
      })

      // Fetch client names in parallel
      const ixcIds = result.data.map(r => r.ixc_cliente_id)
      const nameMap = await fetchClientNamesByIxcIds(tenantId, ixcIds)
      setClientNameMap(nameMap)
      setUniqueClients(new Set(ixcIds).size)

      setReceivables(result.data.map(r => toShape(r, nameMap)))
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar recebimentos.')
      setReceivables([])
    } finally {
      setLoading(false)
    }
  }, [page, limit, appliedFilters])

  const [throttledFetch, refreshBusy] = useThrottledAction(fetchReceivablesData)

  useEffect(() => { void fetchReceivablesData() }, [fetchReceivablesData])

  const handleFilterApply = () => {
    setPage(1)
    setAppliedFilters({ category, dateFrom, dateTo })
  }

  const visibleReceivables = sortReceivables(
    receivables.filter((item) => {
      const term = search.trim().toLowerCase()
      if (!term) return true
      return [item.cliente_nome, item.id_cliente, item.id, getPaymentBehaviorLabel(item)]
        .map((v) => String(v ?? '').toLowerCase())
        .some((v) => v.includes(term))
    }),
    sortBy
  )

  const scoreSummary = {
    fivePoints: visibleReceivables.filter((item) => getPaymentScore(item) === 5).length,
    fourPoints: visibleReceivables.filter((item) => getPaymentScore(item) === 4).length,
    twoPoints: visibleReceivables.filter((item) => getPaymentScore(item) === 2).length,
  }

  const totalPoints = visibleReceivables.reduce((sum, item) => sum + getPaymentScore(item), 0)

  return (
    <ProtectedRoute>
      <Layout>
        <PageHeader
          icon={TrendingUp}
          title="Gestão de Pontuação"
          subtitle="Acompanhe pagamentos e pontos dos clientes"
        />

        {/* Summary cards */}
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Clientes</p>
                <p className="text-xl font-bold text-foreground">{loading ? '...' : uniqueClients}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-4.5 w-4.5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Antecipados</p>
                <p className="text-xl font-bold text-emerald-400">{loading ? '...' : scoreSummary.fivePoints}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10">
                <Award className="h-4.5 w-4.5 text-sky-400" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">No vencimento</p>
                <p className="text-xl font-bold text-sky-400">{loading ? '...' : scoreSummary.fourPoints}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                <Clock className="h-4.5 w-4.5 text-amber-400" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Após vencimento</p>
                <p className="text-xl font-bold text-amber-400">{loading ? '...' : scoreSummary.twoPoints}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Situação</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Data inicial</label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} lang="pt-BR" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Data final</label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} lang="pt-BR" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Buscar</label>
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, CPF ou ID" />
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-end xl:gap-4">
                <div className="min-w-0 space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Ordenar</label>
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-24 space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Exibir</label>
                  <Select value={String(limit)} onValueChange={(value) => { setLimit(Number(value)); setPage(1) }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((size) => (
                        <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="responsive-action-group xl:ml-auto xl:justify-end">
                  <div>
                    <Button onClick={handleFilterApply} className="min-h-[2.75rem]">
                      <Search className="h-3.5 w-3.5" />
                      Aplicar
                    </Button>
                  </div>
                  <div>
                    <Button variant="outline" size="icon" className="min-h-[2.75rem] min-w-[2.75rem]" disabled={refreshBusy} onClick={() => void throttledFetch()}>
                      <RefreshCw className={`h-3.5 w-3.5 transition-transform ${refreshBusy ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16"><Spinner size="md" /></div>
              ) : error ? (
                <div className="m-5 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 flex-shrink-0 text-destructive" />
                    <p className="text-sm text-foreground">{error}</p>
                  </div>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => void fetchReceivablesData()}>Tentar novamente</Button>
                </div>
              ) : receivables.length === 0 ? (
                <div className="py-16 text-center">
                  <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">Nenhum registro encontrado.</p>
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="grid gap-2 p-4 md:hidden">
                    {visibleReceivables.map((item) => {
                      const score = getPaymentScore(item)
                      return (
                        <Link key={item.id} to={`/receivables/${item.id}`} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4 transition-all duration-200 hover:bg-[hsl(var(--muted))]">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-medium text-foreground">{formatClientLabel(item)}</p>
                              <p className="mt-1 text-xs text-muted-foreground">IXC #{item.id_cliente}</p>
                            </div>
                            {scoreBadge(score)}
                          </div>
                          <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{formatDate(item.data_vencimento)}</span>
                            <span className="font-semibold text-emerald-400">{formatBRL(item.valor_recebido)}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">{getPaymentBehaviorLabel(item)}</span>
                            {statusBadge(item.status)}
                          </div>
                        </Link>
                      )
                    })}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Classificação</TableHead>
                          <TableHead className="text-center">Pontos</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-right" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleReceivables.map((item) => {
                          const score = getPaymentScore(item)
                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-foreground">{formatClientLabel(item)}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">IXC #{formatText(item.id_cliente)}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{getPaymentBehaviorLabel(item)}</TableCell>
                              <TableCell className="text-center">{scoreBadge(score)}</TableCell>
                              <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(item.data_vencimento)}</TableCell>
                              <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(item.data_pagamento ?? '')}</TableCell>
                              <TableCell className="whitespace-nowrap text-right font-medium text-emerald-400">{formatBRL(item.valor_recebido)}</TableCell>
                              <TableCell className="text-center">{statusBadge(item.status)}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="outline" size="sm" asChild className="h-7 px-3 text-xs">
                                  <Link to={`/receivables/${item.id}`}>
                                    <ArrowRight className="h-3 w-3 mr-1" />
                                    Ver
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="border-t border-[hsl(var(--border))] px-4 py-4 sm:px-5">
                    <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
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
