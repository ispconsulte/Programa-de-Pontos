import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useThrottledAction } from '@/hooks/useThrottledAction'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  FileText,
  Gift,
  Hash,
  Mail,
  Phone,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import Layout, { DASHBOARD_CLIENT_SEARCH_EVENT, type DashboardSearchType as HeaderSearchType } from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import AlertBanner from '@/components/AlertBanner'
import Spinner from '@/components/Spinner'
import EmptyState from '@/components/EmptyState'
import { categoryBadge, statusBadge } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  autocompleteCampaignClients,
  fetchCampaignClientFaturas,
  fetchCampaignClientById,
  fetchDashboardHistory,
  fetchDashboardMetrics,
  getCurrentTenantId,
  type CampaignClientRow,
  type DashboardHistoryRow,
  type ReceivableRow,
} from '@/lib/supabase-queries'

/* ── Types ────────────────────────────────────────────────────────────── */

type Classification = 'antecipado' | 'vencimento' | 'atraso' | 'indefinido'

interface DashboardRow extends DashboardHistoryRow {
  deltaVencimento: number | null
  classificacao: Classification
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function formatPoints(value: number): string { return value.toLocaleString('pt-BR') }

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
  return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
}

function getDeltaVencimento(pagamento: string | null, vencimento: string | null): number | null {
  const p = toLocalDate(pagamento), d = toLocalDate(vencimento)
  if (!p || !d) return null
  return Math.round((d.getTime() - p.getTime()) / 86_400_000)
}

function classifyByDates(delta: number | null): Classification {
  if (delta === null) return 'indefinido'
  if (delta > 0) return 'antecipado'
  if (delta === 0) return 'vencimento'
  return 'atraso'
}

function classificationLabel(v: Classification): string {
  if (v === 'antecipado') return 'Antecipado'
  if (v === 'vencimento') return 'No vencimento'
  if (v === 'atraso') return 'Após vencimento'
  return '—'
}

function monthDateRange() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10), label: 'Mês atual' }
}

const avatarColors = [
  'bg-emerald-500/15 text-emerald-500', 'bg-sky-500/15 text-sky-500',
  'bg-amber-500/15 text-amber-500', 'bg-rose-500/15 text-rose-500',
  'bg-violet-500/15 text-violet-500', 'bg-teal-500/15 text-teal-500',
]
function avatarColor(name: string): string {
  return avatarColors[(name || '#').charCodeAt(0) % avatarColors.length]
}

function classificationAccent(c: Classification): string {
  if (c === 'antecipado') return 'border-l-emerald-500'
  if (c === 'atraso') return 'border-l-rose-500'
  if (c === 'vencimento') return 'border-l-sky-500'
  return 'border-l-transparent'
}

/* ── Autocomplete hook ────────────────────────────────────────────────── */

function useAutocomplete() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<CampaignClientRow[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (value: string) => {
    if (value.trim().length < 2) { setSuggestions([]); setShowDropdown(false); return }
    setLoading(true)
    try {
      const tenantId = await getCurrentTenantId()
      if (!tenantId) return
      const results = await autocompleteCampaignClients({ tenantId, query: value })
      setSuggestions(results)
      setShowDropdown(results.length > 0)
    } catch { setSuggestions([]) } finally { setLoading(false) }
  }, [])

  const handleChange = useCallback((value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 300)
  }, [search])

  const close = useCallback(() => { setTimeout(() => setShowDropdown(false), 200) }, [])

  return { query, setQuery, suggestions, loading, showDropdown, setShowDropdown, handleChange, close }
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  /* --- Dashboard state --- */
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [metrics, setMetrics] = useState({ totalPoints: 0, redemptionsCount: 0, redeemedPoints: 0 })
  const [rows, setRows] = useState<DashboardRow[]>([])
  const [summary, setSummary] = useState({ antecipado: 0, vencimento: 0, atraso: 0 })
  const [searchType, setSearchType] = useState<HeaderSearchType>('name')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCalmModal, setShowCalmModal] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(true)
  const clickCountRef = useRef(0)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const period = useMemo(() => monthDateRange(), [])

  /* --- Client search state --- */
  const ac = useAutocomplete()
  const [selectedClient, setSelectedClient] = useState<CampaignClientRow | null>(null)
  const [faturas, setFaturas] = useState<ReceivableRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [clientError, setClientError] = useState('')

  /* --- Dashboard data fetch --- */
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const tenantId = await getCurrentTenantId()
      if (!tenantId) { setError('Usuário não associado a um tenant.'); return }
      const [metricData, fullRows, latestRows] = await Promise.all([
        fetchDashboardMetrics({ tenantId, dateFrom: period.from, dateTo: period.to }),
        fetchDashboardHistory({ tenantId, dateFrom: period.from, dateTo: period.to, limit: 10000 }),
        fetchDashboardHistory({ tenantId, dateFrom: period.from, dateTo: period.to, limit: 8, searchType, searchQuery }),
      ])
      const classify = (row: DashboardHistoryRow) => {
        const delta = getDeltaVencimento(row.data_pagamento, row.data_vencimento)
        return { ...row, deltaVencimento: delta, classificacao: classifyByDates(delta) }
      }
      const full = fullRows.map(classify)
      setMetrics(metricData)
      setRows(latestRows.map(classify))
      setSummary({
        antecipado: full.filter(r => r.classificacao === 'antecipado').reduce((s, r) => s + Number(r.pontos_gerados || 0), 0),
        vencimento: full.filter(r => r.classificacao === 'vencimento').reduce((s, r) => s + Number(r.pontos_gerados || 0), 0),
        atraso: full.filter(r => r.classificacao === 'atraso').reduce((s, r) => s + Number(r.pontos_gerados || 0), 0),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados.')
    } finally { setLoading(false) }
  }, [period.from, period.to, searchType, searchQuery])

  const [throttledFetch, refreshBusy] = useThrottledAction(fetchData)

  const handleRefresh = () => {
    clickCountRef.current += 1
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    clickTimerRef.current = setTimeout(() => { clickCountRef.current = 0 }, 4000)
    if (clickCountRef.current >= 3) { setShowCalmModal(true); clickCountRef.current = 0; return }
    void throttledFetch()
  }

  /* --- Client selection --- */
  const selectClient = useCallback(async (client: CampaignClientRow) => {
    ac.setQuery(client.nome_cliente || '')
    ac.setShowDropdown(false)
    setSelectedClient(client)
    setDetailLoading(true)
    setClientError('')
    try {
      const tenantId = await getCurrentTenantId()
      if (!tenantId) { setClientError('Tenant não encontrado.'); return }
      console.log('[Dashboard] selectClient:', { clientId: client.id, tenantId })
      const faturasData = await fetchCampaignClientFaturas(tenantId, client.id)
      console.log('[Dashboard] faturas loaded:', faturasData.length)
      setFaturas(faturasData)
    } catch (err) {
      console.error('[Dashboard] selectClient error:', err)
      setClientError(err instanceof Error ? err.message : 'Erro ao carregar faturas.')
    } finally { setDetailLoading(false) }
  }, [ac])

  const refreshClient = useCallback(async () => {
    if (!selectedClient) return
    setDetailLoading(true)
    try {
      const tenantId = await getCurrentTenantId()
      if (!tenantId) return
      const [updated, faturasData] = await Promise.all([
        fetchCampaignClientById(tenantId, selectedClient.id),
        fetchCampaignClientFaturas(tenantId, selectedClient.id),
      ])
      if (updated) setSelectedClient(updated)
      setFaturas(faturasData)
    } catch (err) {
      setClientError(err instanceof Error ? err.message : 'Erro ao atualizar.')
    } finally { setDetailLoading(false) }
  }, [selectedClient])

  const [throttledClientRefresh, clientRefreshBusy] = useThrottledAction(refreshClient)

  const clearSelection = useCallback(() => {
    setSelectedClient(null)
    setFaturas([])
    ac.setQuery('')
    setClientError('')
  }, [ac])

  /* --- Events --- */
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
          {/* ═══ CLIENT SEARCH — primary section ═══ */}
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Search className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Buscar cliente</h2>
                <p className="text-[11px] text-muted-foreground">Digite o nome ou CPF/CNPJ</p>
              </div>
            </div>
            <div className="relative" onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) ac.close()
            }}>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                value={ac.query}
                onChange={(e) => {
                  ac.handleChange(e.target.value)
                  if (selectedClient) clearSelection()
                }}
                onFocus={() => { if (ac.suggestions.length > 0) ac.setShowDropdown(true) }}
                placeholder="Ex: João Silva ou 123.456.789-00"
                className="h-12 pl-10 text-base bg-background border-border"
                autoComplete="off"
              />
              {ac.loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2"><Spinner size="sm" /></div>
              )}

              {/* Dropdown */}
              {ac.showDropdown && ac.suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-lg max-h-72 overflow-y-auto">
                  {ac.suggestions.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onMouseDown={() => selectClient(client)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted first:rounded-t-xl last:rounded-b-xl"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(client.nome_cliente || '#')}`}>
                          {(client.nome_cliente?.trim()?.[0] || '#').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{client.nome_cliente}</p>
                          <p className="text-xs text-muted-foreground">{client.documento || 'Sem documento'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-bold text-[hsl(var(--success))]">{client.pontos_disponiveis ?? 0} pts</span>
                        {statusBadge(client.status ?? '—')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {ac.query.trim().length > 0 && ac.query.trim().length < 2 && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">Digite ao menos 2 caracteres.</p>
            )}
          </section>

          {/* ═══ SELECTED CLIENT — inline detail ═══ */}
          {selectedClient && (
            <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
              {clientError && <AlertBanner variant="error" message={clientError} />}

              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearSelection}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarColor(selectedClient.nome_cliente || '#')}`}>
                    {(selectedClient.nome_cliente?.trim()?.[0] || '#').toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{selectedClient.nome_cliente}</h2>
                    <p className="text-xs text-muted-foreground">{selectedClient.documento || 'Sem documento'}</p>
                  </div>
                  <div className="ml-2">{statusBadge(selectedClient.status ?? '—')}</div>
                </div>
                <Button variant="outline" size="icon" className="h-9 w-9" disabled={clientRefreshBusy} onClick={() => void throttledClientRefresh()}>
                  <RefreshCw className={`h-3.5 w-3.5 ${clientRefreshBusy ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Points */}
              <div className="grid gap-3 sm:grid-cols-3">
                <PointCard label="Acumulados" value={selectedClient.pontos_acumulados} icon={TrendingUp} variant="emerald" />
                <PointCard label="Resgatados" value={selectedClient.pontos_resgatados} icon={Gift} variant="amber" />
                <PointCard label="Disponíveis" value={selectedClient.pontos_disponiveis ?? 0} icon={Coins} variant="primary" />
              </div>

              {/* Info */}
              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Informações</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <InfoField icon={Users} label="Nome">{selectedClient.nome_cliente}</InfoField>
                    <InfoField icon={FileText} label="CPF/CNPJ">{selectedClient.documento || '-'}</InfoField>
                    <InfoField icon={Mail} label="E-mail">{selectedClient.email || '-'}</InfoField>
                    <InfoField icon={Phone} label="Telefone">{selectedClient.telefone || '-'}</InfoField>
                    <InfoField icon={Hash} label="ID IXC">{selectedClient.ixc_cliente_id}</InfoField>
                    <InfoField icon={Briefcase} label="Contrato">{selectedClient.ixc_contrato_id || '-'}</InfoField>
                  </div>
                </CardContent>
              </Card>

              {/* Faturas */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Faturas processadas</CardTitle>
                    <span className="rounded-lg bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{faturas.length}</span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {detailLoading ? (
                    <div className="flex items-center justify-center py-10"><Spinner size="md" /></div>
                  ) : faturas.length === 0 ? (
                    <div className="py-10 text-center"><p className="text-sm text-muted-foreground">Nenhuma fatura processada.</p></div>
                  ) : (
                    <>
                      <div className="grid gap-2 p-3 md:hidden">
                        {faturas.map((f) => (
                          <div key={f.id} className="rounded-lg border border-border bg-background p-3 text-sm">
                            <div className="flex justify-between">
                              <span className="font-mono text-xs text-muted-foreground">#{f.fatura_id}</span>
                              {statusBadge(f.status_processamento)}
                            </div>
                            <div className="mt-2 flex justify-between text-xs">
                              <span className="text-muted-foreground">Pagamento: {formatDate(f.data_pagamento)}</span>
                              <span className="font-semibold text-[hsl(var(--success))]">+{f.pontos_gerados} pts</span>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">Valor: {formatBRL(f.valor_pago ?? 0)}</div>
                          </div>
                        ))}
                      </div>
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fatura</TableHead>
                              <TableHead>Pagamento</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                              <TableHead className="text-right">Pontos</TableHead>
                              <TableHead className="text-center">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {faturas.map((f) => (
                              <TableRow key={f.id}>
                                <TableCell className="font-mono text-xs text-foreground">{f.fatura_id}</TableCell>
                                <TableCell className="text-muted-foreground text-xs">{formatDate(f.data_pagamento)}</TableCell>
                                <TableCell className="text-right text-[hsl(var(--success))]">{formatBRL(f.valor_pago ?? 0)}</TableCell>
                                <TableCell className="text-right font-semibold text-[hsl(var(--success))]">+{f.pontos_gerados}</TableCell>
                                <TableCell className="text-center">{statusBadge(f.status_processamento)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/clients/${selectedClient.id}`}>Ver detalhes completos <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </div>
          )}

          {/* ═══ KPI CARDS ═══ */}
          {!selectedClient && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <KpiCard label="Pontos acumulados" value={formatPoints(metrics.totalPoints)} helper={period.label} icon={Coins} gradient="from-emerald-500/10 to-emerald-500/[0.02]" iconClass="bg-emerald-500/15 text-emerald-500" />
                <KpiCard label="Resgates realizados" value={formatPoints(metrics.redemptionsCount)} helper={period.label} icon={Wallet} gradient="from-amber-500/10 to-amber-500/[0.02]" iconClass="bg-amber-500/15 text-amber-500" />
                <KpiCard label="Pontos resgatados" value={formatPoints(metrics.redeemedPoints)} helper={period.label} icon={Zap} gradient="from-primary/10 to-primary/[0.02]" iconClass="bg-primary/15 text-primary" />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryChip icon={Zap} value={formatPoints(summary.antecipado)} label="Antecipados" color="emerald" />
                <SummaryChip icon={CalendarCheck} value={formatPoints(summary.vencimento)} label="No vencimento" color="sky" />
                <SummaryChip icon={Clock} value={formatPoints(summary.atraso)} label="Após vencimento" color="rose" />
              </div>

              {/* ═══ COLLAPSIBLE HISTORY ═══ */}
              <section className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setHistoryOpen(!historyOpen)}
                  className="flex w-full items-center justify-between border-b border-border px-5 py-4 transition-colors hover:bg-muted/30"
                >
                  <h2 className="text-sm font-bold text-foreground">Últimos registros</h2>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={refreshBusy} onClick={(e) => { e.stopPropagation(); handleRefresh() }}>
                      <RefreshCw className={`h-3.5 w-3.5 ${refreshBusy ? 'animate-spin' : ''}`} />
                    </Button>
                    {historyOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {historyOpen && (
                  <>
                    {loading ? (
                      <div className="flex items-center justify-center py-12"><Spinner size="md" /></div>
                    ) : error ? (
                      <div className="p-5"><AlertBanner variant="error" message={error} actionLabel="Tentar novamente" onAction={() => void fetchData()} /></div>
                    ) : rows.length === 0 ? (
                      <div className="p-5"><EmptyState icon={<Coins className="h-5 w-5" />} title="Nenhum registro" description="Sem registros de pontuação neste período." /></div>
                    ) : (
                      <>
                        {/* Mobile */}
                        <div className="divide-y divide-border md:hidden">
                          {rows.map((item) => (
                            <div
                              key={item.id}
                              className={`flex items-center gap-3 border-l-[3px] px-4 py-3.5 ${classificationAccent(item.classificacao)}`}
                            >
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(item.cliente_nome || '#')}`}>
                                {(item.cliente_nome?.trim()?.[0] || '#').toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{item.cliente_nome?.trim() || `#${item.ixc_cliente_id}`}</p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">{classificationLabel(item.classificacao)} · {formatDate(item.data_pagamento)}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-[hsl(var(--success))]">+{formatPoints(item.pontos_gerados)}</p>
                                <p className="text-[10px] text-muted-foreground">{formatBRL(Number(item.valor_pago ?? 0))}</p>
                              </div>
                            </div>
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
                                    <div className="flex items-center gap-3">
                                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${avatarColor(item.cliente_nome || '#')}`}>
                                        {(item.cliente_nome?.trim()?.[0] || '#').toUpperCase()}
                                      </div>
                                      <span className="font-medium text-foreground">{item.cliente_nome?.trim() || `#${item.ixc_cliente_id}`}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3.5 text-center">{categoryBadge(item.classificacao)}</td>
                                  <td className="px-3 py-3.5 text-center">
                                    <span className="inline-flex items-center rounded-md bg-[hsl(var(--success)/0.1)] px-2 py-0.5 text-xs font-bold text-[hsl(var(--success))]">+{formatPoints(item.pontos_gerados)}</span>
                                  </td>
                                  <td className="px-3 py-3.5 text-muted-foreground">{formatDate(item.data_vencimento)}</td>
                                  <td className="px-3 py-3.5 text-muted-foreground">{formatDate(item.data_pagamento)}</td>
                                  <td className="px-5 py-3.5 text-right font-semibold text-foreground">{formatBRL(Number(item.valor_pago ?? 0))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="border-t border-border px-5 py-3 flex justify-end">
                          <Button asChild variant="outline" size="sm">
                            <Link to="/receivables">Ver todos <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </section>
            </>
          )}
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
  label: string; value: string; helper: string; icon: React.ElementType; gradient: string; iconClass: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-border bg-gradient-to-br ${gradient} p-5`}>
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconClass}`}><Icon className="h-4 w-4" /></div>
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  )
}

function SummaryChip({ icon: Icon, value, label, color }: {
  icon: React.ElementType; value: string; label: string; color: 'emerald' | 'sky' | 'rose'
}) {
  const styles = { emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', sky: 'bg-sky-500/10 text-sky-500 border-sky-500/20', rose: 'bg-rose-500/10 text-rose-500 border-rose-500/20' }
  const iconBg = { emerald: 'bg-emerald-500/15 text-emerald-500', sky: 'bg-sky-500/15 text-sky-500', rose: 'bg-rose-500/15 text-rose-500' }
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${styles[color]}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg[color]}`}><Icon className="h-3.5 w-3.5" /></div>
      <div className="min-w-0">
        <p className="text-xl font-bold">{value}</p>
        <p className="truncate text-[11px] opacity-70">{label}</p>
      </div>
    </div>
  )
}

function PointCard({ label, value, icon: Icon, variant }: { label: string; value: number; icon: React.ElementType; variant: 'emerald' | 'amber' | 'primary' }) {
  const colors = { emerald: 'border-emerald-500/20 bg-emerald-500/[0.04]', amber: 'border-amber-500/20 bg-amber-500/[0.04]', primary: 'border-primary/20 bg-primary/[0.04]' }
  return (
    <div className={`rounded-xl border p-3 ${colors[variant]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-bold text-foreground">{value.toLocaleString('pt-BR')}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/[0.05]"><Icon className="h-4 w-4 text-foreground/50" /></div>
      </div>
    </div>
  )
}

function InfoField({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-card p-2.5">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-muted"><Icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="mt-0.5 truncate text-sm text-foreground">{children || '-'}</div>
      </div>
    </div>
  )
}
