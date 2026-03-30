import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Coins, RefreshCw, Search, ShieldAlert } from 'lucide-react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import { statusBadge } from '@/components/Badge'
import Pagination from '@/components/Pagination'
import { apiFetch, getApiErrorMessage, getDisplayError } from '@/lib/api-client'
import { getPaymentBehaviorLabel, getPaymentScore, toNumber } from '@/lib/receivables-utils'
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

interface Receivable {
  id: string | number
  id_cliente: string | number
  cliente_nome?: string | null
  data_vencimento: string
  data_pagamento?: string | null
  valor: string | number
  valor_recebido: string | number
  status: string
  categoria: string
  categoria_codigo?: string
}

interface ReceivablesResponse {
  data: Receivable[]
  total: number
  page: number
  limit: number
  totalPages?: number
  pagination?: {
    total?: number
    totalPages?: number
  }
}

interface AppliedFilters {
  category: string
  dateFrom: string
  dateTo: string
}

type SortOption = 'due_desc' | 'due_asc' | 'payment_desc' | 'payment_asc' | 'received_desc' | 'received_asc' | 'points_desc' | 'points_asc'

function formatBRL(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return 'Não encontrado'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return 'Não encontrado'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr === '0000-00-00' || dateStr === '0000-00-00 00:00:00') return 'Não encontrado'
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  if (Number.isNaN(d.getTime())) return 'Não encontrado'
  return d.toLocaleDateString('pt-BR')
}

function formatText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return 'Não encontrado'
  const text = String(value).trim()
  if (!text || text === '-' || text.toLowerCase() === 'undefined' || text.toLowerCase() === 'null') {
    return 'Não encontrado'
  }
  return text
}

function formatClientLabel(receivable: Receivable): string {
  const name = receivable.cliente_nome?.trim()
  if (name) return name
  return `Cliente #${receivable.id_cliente}`
}

const CATEGORIES = [
  { value: 'all', label: 'Todas' },
  { value: 'received', label: 'Recebido' },
  { value: 'renegotiated', label: 'Renegociado' },
  { value: 'open', label: 'Aberto' },
  { value: 'cancelled', label: 'Cancelado' },
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
      case 'due_asc':
        return toComparableDate(a.data_vencimento) - toComparableDate(b.data_vencimento)
      case 'due_desc':
        return toComparableDate(b.data_vencimento) - toComparableDate(a.data_vencimento)
      case 'payment_asc':
        return toComparableDate(a.data_pagamento) - toComparableDate(b.data_pagamento)
      case 'payment_desc':
        return toComparableDate(b.data_pagamento) - toComparableDate(a.data_pagamento)
      case 'received_asc':
        return (toNumber(a.valor_recebido) ?? 0) - (toNumber(b.valor_recebido) ?? 0)
      case 'received_desc':
        return (toNumber(b.valor_recebido) ?? 0) - (toNumber(a.valor_recebido) ?? 0)
      case 'points_asc':
        return getPaymentScore(a) - getPaymentScore(b)
      case 'points_desc':
        return getPaymentScore(b) - getPaymentScore(a)
      default:
        return 0
    }
  })
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
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    category: 'all',
    dateFrom: '',
    dateTo: '',
  })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('due_desc')

  const fetchReceivables = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (appliedFilters.category && appliedFilters.category !== 'all') params.set('category', appliedFilters.category)
      if (appliedFilters.dateFrom) params.set('dateFrom', appliedFilters.dateFrom)
      if (appliedFilters.dateTo) params.set('dateTo', appliedFilters.dateTo)

      const res = await apiFetch(`/receivables?${params.toString()}`)
      if (!res.ok) {
        setError(await getApiErrorMessage(res, 'Erro ao carregar recebimentos.'))
        setReceivables([])
        return
      }

      const json: ReceivablesResponse = await res.json()
      setReceivables(json.data || [])
      const computedTotal = json.total ?? json.pagination?.total ?? 0
      setTotal(computedTotal)
      setTotalPages(json.totalPages || json.pagination?.totalPages || Math.max(1, Math.ceil(computedTotal / limit)))
    } catch (err) {
      setError(getDisplayError(err, 'Erro ao carregar recebimentos.'))
      setReceivables([])
    } finally {
      setLoading(false)
    }
  }, [page, limit, appliedFilters])

  useEffect(() => {
    void fetchReceivables()
  }, [fetchReceivables])

  const handleFilterApply = () => {
    setPage(1)
    setAppliedFilters({ category, dateFrom, dateTo })
  }

  const visibleReceivables = sortReceivables(
    receivables.filter((item) => {
      const term = search.trim().toLowerCase()
      if (!term) return true
      return [item.cliente_nome, item.id_cliente, item.id, getPaymentBehaviorLabel(item)]
        .map((value) => String(value ?? '').toLowerCase())
        .some((value) => value.includes(term))
    }),
    sortBy
  )

  const scoreSummary = {
    fivePoints: visibleReceivables.filter((item) => getPaymentScore(item) === 5).length,
    fourPoints: visibleReceivables.filter((item) => getPaymentScore(item) === 4).length,
    twoPoints: visibleReceivables.filter((item) => getPaymentScore(item) === 2).length,
  }

  return (
    <ProtectedRoute>
      <Layout>
        <PageHeader
          icon={Coins}
          title="Pontuação"
          subtitle="Recebimentos e bônus"
          actions={
            <span className="text-xs text-muted-foreground">
              {loading ? 'Carregando...' : `${total} registros`}
            </span>
          }
        />

        <div className="space-y-5">
          <Card>
            <CardContent className="p-5">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Situação do pagamento</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Vencimento de</label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="[color-scheme:dark]" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Vencimento até</label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="[color-scheme:dark]" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Buscar cliente</label>
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou ID" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ordenar por</label>
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Por página</label>
                  <Select value={String(limit)} onValueChange={(value) => { setLimit(Number(value)); setPage(1) }}>
                    <SelectTrigger className="w-full sm:w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((size) => (
                        <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button onClick={handleFilterApply}>
                  <Search className="h-3.5 w-3.5" />
                  Aplicar
                </Button>
                <Button variant="outline" size="icon" onClick={() => void fetchReceivables()}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Spinner size="md" />
                </div>
              ) : error ? (
                <div className="m-5 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 flex-shrink-0 text-destructive" />
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => void fetchReceivables()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : receivables.length === 0 ? (
                <div className="py-16 text-center">
                  <Coins className="mx-auto h-8 w-8 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">Nenhum registro encontrado.</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 border-b border-white/[0.04] px-5 py-4 md:grid-cols-3">
                    {[
                      { label: '5 pontos', helper: 'Pagamentos antecipados', value: scoreSummary.fivePoints, color: 'text-emerald-400' },
                      { label: '4 pontos', helper: 'Pagamentos no vencimento', value: scoreSummary.fourPoints, color: 'text-sky-400' },
                      { label: '2 pontos', helper: 'Pagamentos apos o vencimento', value: scoreSummary.twoPoints, color: 'text-amber-400' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
                        <p className={`mt-2 text-2xl font-semibold ${item.color}`}>{item.value}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.helper}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-2 p-4 md:hidden">
                    {visibleReceivables.map((item) => (
                      <Link key={item.id} to={`/receivables/${item.id}`} className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4 transition-all duration-200 hover:bg-white/[0.03] hover:border-white/[0.08]">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-white">{formatClientLabel(item)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Recebimento #{item.id}</p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{getPaymentBehaviorLabel(item)}</span>
                          <span className="font-semibold text-emerald-400">+{getPaymentScore(item)} pts</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{formatDate(item.data_vencimento)}</span>
                          <span className="font-medium text-emerald-400">{formatBRL(item.valor_recebido)}</span>
                        </div>
                        <div className="mt-2">{statusBadge(item.status)}</div>
                      </Link>
                    ))}
                  </div>

                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Recebimento</TableHead>
                          <TableHead>Faixa</TableHead>
                          <TableHead className="text-right">Pontos</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Pago em</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Recebido</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleReceivables.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-slate-300">
                              <div>
                                <p className="font-medium text-white">{formatClientLabel(item)}</p>
                                <p className="mt-1 text-xs text-muted-foreground">Cliente #{formatText(item.id_cliente)}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-white">{item.id}</TableCell>
                            <TableCell className="text-slate-300">{getPaymentBehaviorLabel(item)}</TableCell>
                            <TableCell className="text-right font-semibold text-emerald-400">+{getPaymentScore(item)}</TableCell>
                            <TableCell className="whitespace-nowrap text-slate-300">{formatDate(item.data_vencimento)}</TableCell>
                            <TableCell className="whitespace-nowrap text-slate-300">{formatDate(item.data_pagamento ?? '')}</TableCell>
                            <TableCell className="whitespace-nowrap text-right font-medium text-white">{formatBRL(item.valor)}</TableCell>
                            <TableCell className="whitespace-nowrap text-right text-emerald-400">{formatBRL(item.valor_recebido)}</TableCell>
                            <TableCell>{statusBadge(item.status)}</TableCell>
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

                  <div className="border-t border-white/[0.04] px-5 py-4">
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
