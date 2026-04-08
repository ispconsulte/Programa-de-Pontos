import { useState, useCallback, useEffect, useRef, FormEvent } from 'react'
import { useThrottledAction } from '@/hooks/useThrottledAction'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Gift, Coins, TrendingUp, RefreshCw, Search, Users, FileText, Mail, Phone, Hash, Briefcase } from 'lucide-react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import Spinner from '@/components/Spinner'
import AlertBanner from '@/components/AlertBanner'
import EmptyState from '@/components/EmptyState'
import { statusBadge } from '@/components/Badge'
import {
  autocompleteCampaignClients,
  fetchCampaignClientById,
  fetchCampaignClientFaturas,
  getCurrentTenantId,
  type CampaignClientRow,
  type ReceivableRow,
} from '@/lib/supabase-queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('pt-BR')
}

function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/* ── Autocomplete hook ────────────────────────────────────────────────────── */

function useAutocomplete() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<CampaignClientRow[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (value: string) => {
    if (value.trim().length < 2) { setSuggestions([]); return }
    setLoading(true)
    try {
      const tenantId = await getCurrentTenantId()
      if (!tenantId) return
      const results = await autocompleteCampaignClients({ tenantId, query: value })
      setSuggestions(results)
      setShowDropdown(results.length > 0)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = useCallback((value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 300)
  }, [search])

  const close = useCallback(() => {
    setTimeout(() => setShowDropdown(false), 200)
  }, [])

  return { query, setQuery, suggestions, loading, showDropdown, setShowDropdown, handleChange, close }
}

/* ── Main page ────────────────────────────────────────────────────────────── */

export default function ClientsPage() {
  const ac = useAutocomplete()
  const [selectedClient, setSelectedClient] = useState<CampaignClientRow | null>(null)
  const [faturas, setFaturas] = useState<ReceivableRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  /* Select a client from the autocomplete */
  const selectClient = useCallback(async (client: CampaignClientRow) => {
    ac.setQuery(client.nome_cliente || '')
    ac.setShowDropdown(false)
    setSelectedClient(client)
    setDetailLoading(true)
    setError('')
    try {
      const tenantId = await getCurrentTenantId()
      if (!tenantId) return
      const faturasData = await fetchCampaignClientFaturas(tenantId, client.id)
      setFaturas(faturasData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar faturas.')
    } finally {
      setDetailLoading(false)
    }
  }, [ac])

  /* Refresh selected client data */
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
      setError(err instanceof Error ? err.message : 'Erro ao atualizar.')
    } finally {
      setDetailLoading(false)
    }
  }, [selectedClient])

  const [throttledRefresh, refreshBusy] = useThrottledAction(refreshClient)

  /* Clear selection */
  const clearSelection = useCallback(() => {
    setSelectedClient(null)
    setFaturas([])
    ac.setQuery('')
    setError('')
  }, [ac])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="page-stack">
          {/* Search bar with autocomplete */}
          <form onSubmit={handleSubmit}>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Digite o nome ou CPF/CNPJ do cliente
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  value={ac.query}
                  onChange={(e) => {
                    ac.handleChange(e.target.value)
                    if (selectedClient) clearSelection()
                  }}
                  onFocus={() => ac.suggestions.length > 0 && ac.setShowDropdown(true)}
                  onBlur={ac.close}
                  placeholder="Ex: João Silva ou 123.456.789-00"
                  className="h-12 pl-10 text-base bg-background border-border"
                  autoComplete="off"
                />
                {ac.loading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Spinner size="sm" />
                  </div>
                )}

                {/* Dropdown suggestions */}
                {ac.showDropdown && ac.suggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-lg max-h-72 overflow-y-auto">
                    {ac.suggestions.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onMouseDown={() => selectClient(client)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted first:rounded-t-xl last:rounded-b-xl"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {client.nome_cliente}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {client.documento || 'Sem documento'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-bold text-[hsl(var(--success))]">
                            {client.pontos_disponiveis ?? 0} pts
                          </span>
                          {statusBadge(client.status ?? '—')}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {ac.query.trim().length > 0 && ac.query.trim().length < 2 && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Digite ao menos 2 caracteres para buscar.
                </p>
              )}
            </div>
          </form>

          {error && <AlertBanner variant="error" message={error} />}

          {/* Selected client detail (inline) */}
          {selectedClient && (
            <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearSelection}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{selectedClient.nome_cliente}</h2>
                    <p className="text-xs text-muted-foreground">
                      {selectedClient.documento || 'Sem documento'} · IXC #{selectedClient.ixc_cliente_id}
                    </p>
                  </div>
                  <div className="ml-2">{statusBadge(selectedClient.status ?? '—')}</div>
                </div>
                <Button variant="outline" size="icon" className="h-9 w-9" disabled={refreshBusy} onClick={() => void throttledRefresh()}>
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshBusy ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Points summary */}
              <div className="grid gap-3 sm:grid-cols-3">
                <PointCard label="Acumulados" value={selectedClient.pontos_acumulados} icon={TrendingUp} variant="emerald" />
                <PointCard label="Resgatados" value={selectedClient.pontos_resgatados} icon={Gift} variant="amber" />
                <PointCard label="Disponíveis" value={selectedClient.pontos_disponiveis ?? 0} icon={Coins} variant="primary" />
              </div>

              {/* Client info */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Informações</CardTitle>
                </CardHeader>
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
                    <span className="rounded-lg bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      {faturas.length}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {detailLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Spinner size="md" />
                    </div>
                  ) : faturas.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-sm text-muted-foreground">Nenhuma fatura processada.</p>
                    </div>
                  ) : (
                    <>
                      {/* Mobile cards */}
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
                            <div className="mt-1 text-xs text-muted-foreground">
                              Valor: {formatBRL(f.valor_pago)}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop table */}
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
                                <TableCell className="text-right text-[hsl(var(--success))]">{formatBRL(f.valor_pago)}</TableCell>
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

              {/* Link to full detail page */}
              <div className="flex justify-end">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/clients/${selectedClient.id}`}>
                    Ver detalhes completos <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Initial state */}
          {!selectedClient && !error && ac.suggestions.length === 0 && !ac.loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <Search className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-foreground">Busque um cliente</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Digite o nome ou CPF para localizar rapidamente.
              </p>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

function InfoField({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-card p-2.5">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="mt-0.5 truncate text-sm text-foreground">{children || '-'}</div>
      </div>
    </div>
  )
}

function PointCard({ label, value, icon: Icon, variant }: { label: string; value: number; icon: React.ElementType; variant: 'emerald' | 'amber' | 'primary' }) {
  const colors = {
    emerald: 'border-emerald-500/20 bg-emerald-500/[0.04]',
    amber: 'border-amber-500/20 bg-amber-500/[0.04]',
    primary: 'border-primary/20 bg-primary/[0.04]',
  }
  return (
    <div className={`rounded-xl border p-3 ${colors[variant]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-bold text-foreground">{value.toLocaleString('pt-BR')}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/[0.05]">
          <Icon className="h-4 w-4 text-foreground/50" />
        </div>
      </div>
    </div>
  )
}
