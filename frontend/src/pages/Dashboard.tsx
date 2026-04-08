import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useThrottledAction } from '@/hooks/useThrottledAction'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Coins,
  FileText,
  Gift,
  Hash,
  Mail,
  Medal,
  Phone,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import AlertBanner from '@/components/AlertBanner'
import Spinner from '@/components/Spinner'
import EmptyState from '@/components/EmptyState'
import { statusBadge } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  autocompleteCampaignClients,
  fetchCampaignClientFaturas,
  fetchCampaignClientRedemptions,
  fetchCampaignClientById,
  fetchClientRanking,
  fetchDashboardMetrics,
  getCurrentTenantId,
  type CampaignClientRow,
  type RankingClientRow,
  type ReceivableRow,
  type RedemptionRow,
} from '@/lib/supabase-queries'

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
  const [ranking, setRanking] = useState<RankingClientRow[]>([])
  const [showCalmModal, setShowCalmModal] = useState(false)
  const [rankingOpen, setRankingOpen] = useState(true)
  const clickCountRef = useRef(0)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const period = useMemo(() => monthDateRange(), [])

  /* --- Client search state --- */
  const ac = useAutocomplete()
  const [selectedClient, setSelectedClient] = useState<CampaignClientRow | null>(null)
  const [faturas, setFaturas] = useState<ReceivableRow[]>([])
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [clientError, setClientError] = useState('')

  /* --- Dashboard data fetch --- */
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const tenantId = await getCurrentTenantId()
      if (!tenantId) { setError('Usuário não associado a um tenant.'); return }
      const [metricData, rankingData] = await Promise.all([
        fetchDashboardMetrics({ tenantId, dateFrom: period.from, dateTo: period.to }),
        fetchClientRanking(tenantId, 10),
      ])
      setMetrics(metricData)
      setRanking(rankingData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados.')
    } finally { setLoading(false) }
  }, [period.from, period.to])

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
      const [faturasData, redemptionsData] = await Promise.all([
        fetchCampaignClientFaturas(tenantId, client.id),
        fetchCampaignClientRedemptions(client.ixc_cliente_id),
      ])
      setFaturas(faturasData)
      setRedemptions(redemptionsData)
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
      const [updated, faturasData, redemptionsData] = await Promise.all([
        fetchCampaignClientById(tenantId, selectedClient.id),
        fetchCampaignClientFaturas(tenantId, selectedClient.id),
        fetchCampaignClientRedemptions(selectedClient.ixc_cliente_id),
      ])
      if (updated) setSelectedClient(updated)
      setFaturas(faturasData)
      setRedemptions(redemptionsData)
    } catch (err) {
      setClientError(err instanceof Error ? err.message : 'Erro ao atualizar.')
    } finally { setDetailLoading(false) }
  }, [selectedClient])

  const [throttledClientRefresh, clientRefreshBusy] = useThrottledAction(refreshClient)

  const clearSelection = useCallback(() => {
    setSelectedClient(null)
    setFaturas([])
    setRedemptions([])
    ac.setQuery('')
    setClientError('')
  }, [ac])

  /* --- Events --- */

  useEffect(() => { void fetchData() }, [fetchData])

  return (
    <ProtectedRoute>
      <Layout>
        <div className="page-stack">
          {/* ═══ SELECTED CLIENT — inline detail ═══ */}
          {selectedClient && (
            <div className="space-y-5 animate-in fade-in-0 slide-in-from-top-2 duration-300">
              {clientError && <AlertBanner variant="error" message={clientError} />}

              {/* Search stays visible at top — compact */}
              <section className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearSelection}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Buscar outro cliente</h2>
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
                    onChange={(e) => { ac.handleChange(e.target.value); clearSelection() }}
                    onFocus={() => { if (ac.suggestions.length > 0) ac.setShowDropdown(true) }}
                    placeholder="Ex: João Silva ou 123.456.789-00"
                    className="h-12 pl-10 text-base bg-background border-border"
                    autoComplete="off"
                  />
                  {ac.loading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Spinner size="sm" /></div>}
                  {ac.showDropdown && ac.suggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-lg max-h-72 overflow-y-auto">
                      {ac.suggestions.map((client) => (
                        <button key={client.id} type="button" onMouseDown={() => selectClient(client)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted first:rounded-t-xl last:rounded-b-xl">
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
              </section>

              {/* Client header — hero-style */}
              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold ${avatarColor(selectedClient.nome_cliente || '#')}`}>
                    {(selectedClient.nome_cliente?.trim()?.[0] || '#').toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-bold text-foreground leading-tight">{selectedClient.nome_cliente}</h2>
                      {statusBadge(selectedClient.status ?? '—')}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{selectedClient.documento || 'Sem documento'}</p>
                  </div>
                </div>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" disabled={clientRefreshBusy} onClick={() => void throttledClientRefresh()}>
                  <RefreshCw className={`h-3.5 w-3.5 ${clientRefreshBusy ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Points — polished cards with larger numbers */}
              <div className="grid gap-3 sm:grid-cols-3">
                <PointCard label="Acumulados" value={selectedClient.pontos_acumulados} icon={TrendingUp} variant="emerald" />
                <PointCard label="Resgatados" value={selectedClient.pontos_resgatados} icon={Gift} variant="amber" />
                <PointCard label="Disponíveis" value={selectedClient.pontos_disponiveis ?? 0} icon={Coins} variant="primary" />
              </div>

              {/* Info — clean grid */}
              <Card className="overflow-hidden">
                <CardHeader className="py-3.5 px-5 border-b border-border">
                  <CardTitle className="text-sm font-bold">Informações</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              <Card className="overflow-hidden">
                <CardHeader className="py-3.5 px-5 border-b border-border">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold">Faturas processadas</CardTitle>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">{faturas.length}</span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {detailLoading ? (
                    <div className="flex items-center justify-center py-12"><Spinner size="md" /></div>
                  ) : faturas.length === 0 ? (
                    <div className="py-12 text-center"><p className="text-sm text-muted-foreground">Nenhuma fatura processada.</p></div>
                  ) : (
                    <>
                      {/* Mobile cards */}
                      <div className="grid gap-2 p-3 md:hidden">
                        {faturas.map((f) => (
                          <div key={f.id} className="rounded-lg border border-border bg-background p-3 text-sm">
                            <div className="flex justify-between items-center">
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
                      {/* Desktop table */}
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="text-[11px] uppercase tracking-wider">Fatura</TableHead>
                              <TableHead className="text-[11px] uppercase tracking-wider">Pagamento</TableHead>
                              <TableHead className="text-right text-[11px] uppercase tracking-wider">Valor</TableHead>
                              <TableHead className="text-right text-[11px] uppercase tracking-wider">Pontos</TableHead>
                              <TableHead className="text-center text-[11px] uppercase tracking-wider">Status</TableHead>
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

              {/* Últimos resgates */}
              <Card className="overflow-hidden">
                <CardHeader className="py-3.5 px-5 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15">
                        <Gift className="h-3.5 w-3.5 text-amber-500" />
                      </div>
                      <CardTitle className="text-sm font-bold">Últimos resgates</CardTitle>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">{redemptions.length}</span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {detailLoading ? (
                    <div className="flex items-center justify-center py-12"><Spinner size="md" /></div>
                  ) : redemptions.length === 0 ? (
                    <div className="py-12 text-center">
                      <Gift className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum resgate realizado.</p>
                    </div>
                  ) : (
                    <>
                      {/* Mobile */}
                      <div className="divide-y divide-border/50 md:hidden">
                        {redemptions.map((r) => (
                          <div key={r.id} className="px-4 py-3.5">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-foreground">{r.brinde_nome}</p>
                              <RedemptionStatusBadge status={r.status_resgate} />
                            </div>
                            <div className="mt-1.5 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{formatDate(r.created_at)}</span>
                              <span className="font-bold text-amber-400">-{r.pontos_utilizados} pts</span>
                            </div>
                            {r.observacoes && <p className="mt-1 text-[11px] text-muted-foreground italic">{r.observacoes}</p>}
                          </div>
                        ))}
                      </div>
                      {/* Desktop */}
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="text-[11px] uppercase tracking-wider">Brinde</TableHead>
                              <TableHead className="text-[11px] uppercase tracking-wider">Data</TableHead>
                              <TableHead className="text-right text-[11px] uppercase tracking-wider">Pontos</TableHead>
                              <TableHead className="text-center text-[11px] uppercase tracking-wider">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {redemptions.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell>
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{r.brinde_nome}</p>
                                    {r.observacoes && <p className="text-[11px] text-muted-foreground italic mt-0.5">{r.observacoes}</p>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">{formatDate(r.created_at)}</TableCell>
                                <TableCell className="text-right font-bold text-amber-400">-{r.pontos_utilizados}</TableCell>
                                <TableCell className="text-center"><RedemptionStatusBadge status={r.status_resgate} /></TableCell>
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
          )}

          {/* ═══ DASHBOARD VIEW (no client selected) ═══ */}
          {!selectedClient && (
            <>
              {/* KPI cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                <KpiCard label="Pontos acumulados" value={formatPoints(metrics.totalPoints)} helper={period.label} icon={Coins} gradient="from-emerald-500/10 to-emerald-500/[0.02]" iconClass="bg-emerald-500/15 text-emerald-500" />
                <KpiCard label="Resgates realizados" value={formatPoints(metrics.redemptionsCount)} helper={period.label} icon={Wallet} gradient="from-amber-500/10 to-amber-500/[0.02]" iconClass="bg-amber-500/15 text-amber-500" />
                <KpiCard label="Pontos resgatados" value={formatPoints(metrics.redeemedPoints)} helper={period.label} icon={Zap} gradient="from-primary/10 to-primary/[0.02]" iconClass="bg-primary/15 text-primary" />
              </div>

              {/* Search bar */}
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
                  {ac.loading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Spinner size="sm" /></div>}
                  {ac.showDropdown && ac.suggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-lg max-h-72 overflow-y-auto">
                      {ac.suggestions.map((client) => (
                        <button key={client.id} type="button" onMouseDown={() => selectClient(client)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted first:rounded-t-xl last:rounded-b-xl">
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

              {/* ═══ RANKING DE CLIENTES ═══ */}
              <section className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setRankingOpen(!rankingOpen)}
                  className="flex w-full items-center justify-between border-b border-border px-5 py-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15">
                      <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                    </div>
                    <h2 className="text-sm font-bold text-foreground">Ranking de recompensas</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={refreshBusy} onClick={(e) => { e.stopPropagation(); handleRefresh() }}>
                      <RefreshCw className={`h-3.5 w-3.5 ${refreshBusy ? 'animate-spin' : ''}`} />
                    </Button>
                    {rankingOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {rankingOpen && (
                  <>
                    {loading ? (
                      <div className="flex items-center justify-center py-12"><Spinner size="md" /></div>
                    ) : error ? (
                      <div className="p-5"><AlertBanner variant="error" message={error} actionLabel="Tentar novamente" onAction={() => void fetchData()} /></div>
                    ) : ranking.length === 0 ? (
                      <div className="p-5"><EmptyState icon={<Coins className="h-5 w-5" />} title="Nenhum participante" description="Ainda não há clientes no programa." /></div>
                    ) : (
                      <>
                        {/* Mobile */}
                        <div className="divide-y divide-border/50 md:hidden">
                          {ranking.map((client, index) => (
                            <div key={client.id} className="flex items-center gap-3 px-4 py-3.5">
                              <RankBadge position={index + 1} />
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(client.nome_cliente || '#')}`}>
                                {(client.nome_cliente?.trim()?.[0] || '#').toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{client.nome_cliente}</p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">{client.documento || 'Sem documento'}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-[hsl(var(--success))]">{formatPoints(client.pontos_acumulados)} pts</p>
                                <p className="text-[10px] text-muted-foreground">Disponível: {formatPoints(client.pontos_disponiveis ?? 0)}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Desktop */}
                        <div className="hidden md:block">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border bg-muted/30">
                                <th className="w-14 px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">#</th>
                                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cliente</th>
                                <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Acumulados</th>
                                <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Resgatados</th>
                                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Disponíveis</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                              {ranking.map((client, index) => (
                                <tr key={client.id} className="group transition-colors hover:bg-muted/40">
                                  <td className="px-3 py-3.5 text-center"><RankBadge position={index + 1} /></td>
                                  <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-3">
                                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${avatarColor(client.nome_cliente || '#')}`}>
                                        {(client.nome_cliente?.trim()?.[0] || '#').toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <span className="font-medium text-foreground">{client.nome_cliente}</span>
                                        <p className="text-[11px] text-muted-foreground">{client.documento || ''}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3.5 text-center">
                                    <span className="inline-flex items-center rounded-md bg-[hsl(var(--success)/0.1)] px-2 py-0.5 text-xs font-bold text-[hsl(var(--success))]">{formatPoints(client.pontos_acumulados)}</span>
                                  </td>
                                  <td className="px-3 py-3.5 text-center">
                                    <span className="text-xs font-semibold text-amber-400">{formatPoints(client.pontos_resgatados)}</span>
                                  </td>
                                  <td className="px-5 py-3.5 text-right font-bold text-foreground">{formatPoints(client.pontos_disponiveis ?? 0)}</td>
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

function RankBadge({ position }: { position: number }) {
  if (position === 1) return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">🥇</span>
  if (position === 2) return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-400/20 text-xs font-bold text-slate-300">🥈</span>
  if (position === 3) return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-700/20 text-xs font-bold text-amber-600">🥉</span>
  return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{position}</span>
}

function PointCard({ label, value, icon: Icon, variant }: { label: string; value: number; icon: React.ElementType; variant: 'emerald' | 'amber' | 'primary' }) {
  const styles = {
    emerald: 'border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-emerald-500/[0.02]',
    amber: 'border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] to-amber-500/[0.02]',
    primary: 'border-primary/25 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02]',
  }
  const iconStyles = {
    emerald: 'bg-emerald-500/15 text-emerald-500',
    amber: 'bg-amber-500/15 text-amber-500',
    primary: 'bg-primary/15 text-primary',
  }
  return (
    <div className={`rounded-xl border p-4 ${styles[variant]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">{value.toLocaleString('pt-BR')}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconStyles[variant]}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  )
}

function InfoField({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 px-3 py-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-3.5 w-3.5 text-primary/70" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/60">{label}</p>
        <div className="mt-0.5 truncate text-sm font-medium text-foreground">{children || '-'}</div>
      </div>
    </div>
  )
}

function RedemptionStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  const map: Record<string, { label: string; cls: string }> = {
    pendente: { label: 'Pendente', cls: 'bg-amber-500/10 text-amber-400' },
    solicitado: { label: 'Solicitado', cls: 'bg-sky-500/10 text-sky-400' },
    entregue: { label: 'Entregue', cls: 'bg-emerald-500/10 text-emerald-400' },
    cancelado: { label: 'Cancelado', cls: 'bg-rose-500/10 text-rose-400' },
  }
  const found = map[s] || { label: status, cls: 'bg-muted text-muted-foreground' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${found.cls}`}>
      {found.label}
    </span>
  )
}
