import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import RegisterRedemptionDialog from '@/components/RegisterRedemptionDialog'
import ManualPointsDialog from '@/components/ManualPointsDialog'
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
import WelcomeModal from '@/components/WelcomeModal'
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
import { fetchCurrentUserProfile, isAdminUiRole } from '@/lib/user-management'
import { friendlyError } from '@/lib/friendly-errors'
import {
  formatPoints, formatDate, formatBRL, persistedDateRange, avatarColor,
  KpiCard, RankBadge, PointCard, InfoField, RedemptionStatusBadge,
} from '@/components/dashboard/DashboardHelpers'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [metrics, setMetrics] = useState({ totalPoints: 0, redemptionsCount: 0, availablePoints: 0 })
  const [ranking, setRanking] = useState<RankingClientRow[]>([])
  const [showCalmModal, setShowCalmModal] = useState(false)
  const [rankingOpen, setRankingOpen] = useState(true)
  const clickCountRef = useRef(0)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const period = useMemo(() => persistedDateRange(), [])

  const ac = useAutocomplete()
  const [selectedClient, setSelectedClient] = useState<CampaignClientRow | null>(null)
  const [faturas, setFaturas] = useState<ReceivableRow[]>([])
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [clientError, setClientError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [userName, setUserName] = useState('')

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
      setError(friendlyError(err))
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
      setClientError(friendlyError(err))
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
      setClientError(friendlyError(err))
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

  useEffect(() => { void fetchData() }, [fetchData])
  useEffect(() => {
    void fetchCurrentUserProfile()
      .then((profile) => {
        setIsAdmin(isAdminUiRole(profile.role))
        setUserName(profile.name || profile.email?.split('@')[0] || '')
      })
      .catch(() => setIsAdmin(false))
  }, [])

  return (
    <ProtectedRoute>
      <Layout>
        <div className="page-stack">
          {selectedClient && (
            <SelectedClientView
              client={selectedClient}
              faturas={faturas}
              redemptions={redemptions}
              detailLoading={detailLoading}
              clientError={clientError}
              clientRefreshBusy={clientRefreshBusy}
              isAdmin={isAdmin}
              ac={ac}
              onClearSelection={clearSelection}
              onSelectClient={selectClient}
              onRefreshClient={() => void throttledClientRefresh()}
            />
          )}

          {!selectedClient && (
            <>
              {isAdmin && (
                <WelcomeModal
                  storagePrefix="admin-welcome"
                  userName={userName}
                  message={
                    <>
                      Uma conferência rápida no <strong>estoque do catálogo</strong> logo no início do
                      expediente mantém o atendimento fluindo sem surpresas. Realize as devidas
                      verificações na quantidade de produtos físicos para evitar imprevistos. Bom trabalho!
                    </>
                    </>
                  }
                />
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <KpiCard label="Pontos acumulados" value={formatPoints(metrics.totalPoints)} helper={period.label} icon={Coins} gradient="from-emerald-500/10 to-emerald-500/[0.02]" iconClass="bg-emerald-500/15 text-emerald-500" />
                <KpiCard label="Resgates realizados" value={formatPoints(metrics.redemptionsCount)} helper={period.label} icon={Wallet} gradient="from-amber-500/10 to-amber-500/[0.02]" iconClass="bg-amber-500/15 text-amber-500" />
                <KpiCard label="Pontos disponíveis" value={formatPoints(metrics.availablePoints)} helper={period.label} icon={Zap} gradient="from-primary/10 to-primary/[0.02]" iconClass="bg-primary/15 text-primary" />
              </div>

              <SearchBar ac={ac} onSelectClient={selectClient} selectedClient={selectedClient} onClearSelection={clearSelection} />

              <RankingSection
                ranking={ranking}
                loading={loading}
                error={error}
                rankingOpen={rankingOpen}
                refreshBusy={refreshBusy}
                onToggleRanking={() => setRankingOpen(!rankingOpen)}
                onRefresh={handleRefresh}
                onRetry={() => void fetchData()}
              />
            </>
          )}
        </div>

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

/* ── Extracted sections ── */


function SearchBar({ ac, onSelectClient, selectedClient, onClearSelection }: {
  ac: ReturnType<typeof useAutocomplete>
  onSelectClient: (c: CampaignClientRow) => void
  selectedClient: CampaignClientRow | null
  onClearSelection: () => void
}) {
  return (
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
            if (selectedClient) onClearSelection()
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
              <button key={client.id} type="button" onMouseDown={() => onSelectClient(client)}
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
  )
}

function RankingSection({ ranking, loading, error, rankingOpen, refreshBusy, onToggleRanking, onRefresh, onRetry }: {
  ranking: RankingClientRow[]
  loading: boolean
  error: string
  rankingOpen: boolean
  refreshBusy: boolean
  onToggleRanking: () => void
  onRefresh: () => void
  onRetry: () => void
}) {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15">
            <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <h2 className="text-sm font-bold text-foreground">Ranking de recompensas</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={refreshBusy} onClick={onRefresh}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshBusy ? 'animate-spin' : ''}`} />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleRanking}>
            {rankingOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </Button>
        </div>
      </div>

      {rankingOpen && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12"><Spinner size="md" /></div>
          ) : error ? (
            <div className="p-5"><AlertBanner variant="error" message={error} actionLabel="Tentar novamente" onAction={onRetry} /></div>
          ) : ranking.length === 0 ? (
            <div className="p-5"><EmptyState icon={<Coins className="h-5 w-5" />} title="Nenhum participante" description="Ainda não há clientes no programa." /></div>
          ) : (
            <>
              {/* Mobile */}
              <div className="divide-y divide-border/50 md:hidden">
                {ranking.map((client, index) => (
                  <div key={client.id} className="flex items-center gap-3 px-4 py-3.5">
                    <RankBadge position={index + 1} />
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(client.nome_cliente || 'A')}`}>
                      {client.nome_cliente?.trim()?.[0] ? client.nome_cliente.trim()[0].toUpperCase() : <Medal className="h-4 w-4" />}
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
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${avatarColor(client.nome_cliente || 'A')}`}>
                              {client.nome_cliente?.trim()?.[0] ? client.nome_cliente.trim()[0].toUpperCase() : <Medal className="h-3.5 w-3.5" />}
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
  )
}

function SelectedClientView({ client, faturas, redemptions, detailLoading, clientError, clientRefreshBusy, isAdmin, ac, onClearSelection, onSelectClient, onRefreshClient }: {
  client: CampaignClientRow
  faturas: ReceivableRow[]
  redemptions: RedemptionRow[]
  detailLoading: boolean
  clientError: string
  clientRefreshBusy: boolean
  isAdmin: boolean
  ac: ReturnType<typeof useAutocomplete>
  onClearSelection: () => void
  onSelectClient: (c: CampaignClientRow) => void
  onRefreshClient: () => void
}) {
  return (
    <div className="space-y-5 animate-in fade-in-0 slide-in-from-top-2 duration-300">
      {clientError && <AlertBanner variant="error" message={clientError} />}

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClearSelection}>
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
            onChange={(e) => { ac.handleChange(e.target.value); onClearSelection() }}
            onFocus={() => { if (ac.suggestions.length > 0) ac.setShowDropdown(true) }}
            placeholder="Ex: João Silva ou 123.456.789-00"
            className="h-12 pl-10 text-base bg-background border-border"
            autoComplete="off"
          />
          {ac.loading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Spinner size="sm" /></div>}
          {ac.showDropdown && ac.suggestions.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-lg max-h-72 overflow-y-auto">
              {ac.suggestions.map((c) => (
                <button key={c.id} type="button" onMouseDown={() => onSelectClient(c)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted first:rounded-t-xl last:rounded-b-xl">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(c.nome_cliente || '#')}`}>
                      {(c.nome_cliente?.trim()?.[0] || '#').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{c.nome_cliente}</p>
                      <p className="text-xs text-muted-foreground">{c.documento || 'Sem documento'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-bold text-[hsl(var(--success))]">{c.pontos_disponiveis ?? 0} pts</span>
                    {statusBadge(c.status ?? '—')}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Client header */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold ${avatarColor(client.nome_cliente || '#')}`}>
            {(client.nome_cliente?.trim()?.[0] || '#').toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-foreground leading-tight">{client.nome_cliente}</h2>
              {statusBadge(client.status ?? '—')}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{client.documento || 'Sem documento'}</p>
          </div>
        </div>
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" disabled={clientRefreshBusy} onClick={onRefreshClient}>
          <RefreshCw className={`h-3.5 w-3.5 ${clientRefreshBusy ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Points */}
      <div className="grid gap-3 sm:grid-cols-3">
        <PointCard label="Acumulados" value={client.pontos_acumulados} icon={TrendingUp} variant="emerald" />
        <PointCard label="Resgatados" value={client.pontos_resgatados} icon={Gift} variant="amber" />
        <PointCard label="Disponíveis" value={client.pontos_disponiveis ?? 0} icon={Coins} variant="primary" />
      </div>

      {/* Quick actions */}
      {(client.pontos_disponiveis ?? 0) > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {client.nome_cliente} tem <span className="text-emerald-400">{(client.pontos_disponiveis ?? 0).toLocaleString('pt-BR')} pts</span> disponíveis
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Registre um resgate diretamente aqui.</p>
          </div>
          {isAdmin && (
            <ManualPointsDialog
              client={client}
              onCompleted={onRefreshClient}
              trigger={
                <Button variant="outline" className="shrink-0">
                  <Coins className="h-3.5 w-3.5 mr-1.5" />
                  Injetar pontos
                </Button>
              }
            />
          )}
          <RegisterRedemptionDialog
            preselectedClient={client}
            onRedemptionComplete={onRefreshClient}
            trigger={
              <Button className="bg-emerald-600 text-white hover:bg-emerald-500 shrink-0">
                <Gift className="h-3.5 w-3.5 mr-1.5" />
                Resgatar
              </Button>
            }
          />
        </div>
      )}

      {/* Info */}
      <Card className="overflow-hidden">
        <CardHeader className="py-3.5 px-5 border-b border-border">
          <CardTitle className="text-sm font-bold">Informações</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <InfoField icon={Users} label="Nome">{client.nome_cliente}</InfoField>
            <InfoField icon={FileText} label="CPF/CNPJ">{client.documento || '-'}</InfoField>
            <InfoField icon={Mail} label="E-mail">{client.email || '-'}</InfoField>
            <InfoField icon={Phone} label="Telefone">{client.telefone || '-'}</InfoField>
            <InfoField icon={Hash} label="ID IXC">{client.ixc_cliente_id}</InfoField>
            <InfoField icon={Briefcase} label="Contrato">{client.ixc_contrato_id || '-'}</InfoField>
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

      {/* Resgates */}
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
  )
}
