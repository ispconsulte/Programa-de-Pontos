import { useState, useCallback, FormEvent } from 'react'
import { useThrottledAction } from '@/hooks/useThrottledAction'
import { Link } from 'react-router-dom'
import { ArrowRight, RefreshCw, Search, Users } from 'lucide-react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import Spinner from '@/components/Spinner'
import AlertBanner from '@/components/AlertBanner'
import EmptyState from '@/components/EmptyState'
import { statusBadge } from '@/components/Badge'
import { searchCampaignClients, getCurrentTenantId, type CampaignClientRow } from '@/lib/supabase-queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

type SearchType = 'name' | 'cpfCnpj' | 'id'

const SEARCH_TYPES: { value: SearchType; label: string; placeholder: string }[] = [
  { value: 'name', label: 'Nome', placeholder: 'Buscar por nome...' },
  { value: 'cpfCnpj', label: 'CPF/CNPJ', placeholder: 'Buscar por CPF ou CNPJ...' },
  { value: 'id', label: 'ID IXC', placeholder: 'Buscar por ID IXC...' },
]

export default function ClientsPage() {
  const [searchType, setSearchType] = useState<SearchType>('cpfCnpj')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clients, setClients] = useState<CampaignClientRow[] | null>(null)
  const [searched, setSearched] = useState(false)

  const runSearch = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setSearched(true)
    try {
      const tenantId = await getCurrentTenantId()
      if (!tenantId) {
        setError('Usuário não associado a um tenant.')
        return
      }
      const list = await searchCampaignClients({ tenantId, searchType, query: query.trim() })
      setClients(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar clientes.')
      setClients(null)
    } finally {
      setLoading(false)
    }
  }, [query, searchType])

  const [throttledSearch, refreshBusy] = useThrottledAction(runSearch)

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    await runSearch()
  }

  const getClientStatus = (client: CampaignClientRow) => client.status ?? '—'

  return (
    <ProtectedRoute>
      <Layout>
        <div className="page-stack">
          {/* Search bar */}
          <form onSubmit={handleSearch}>
            <div className="rounded-xl border border-border bg-card p-4">
              {/* Tabs inline */}
              <div className="mb-3 flex gap-1">
                {SEARCH_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => { setSearchType(type.value); setQuery('') }}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                      searchType === type.value
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {/* Input + button */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={SEARCH_TYPES.find((t) => t.value === searchType)?.placeholder}
                    className="h-11 pl-10 bg-background border-border"
                  />
                </div>
                <Button type="submit" disabled={loading || !query.trim()} className="h-11 px-5">
                  {loading ? <Spinner size="sm" /> : 'Buscar'}
                </Button>
                {searched && (
                  <Button type="button" variant="outline" size="icon" className="h-11 w-11" disabled={refreshBusy} onClick={() => void throttledSearch()}>
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshBusy ? 'animate-spin' : ''}`} />
                  </Button>
                )}
              </div>
            </div>
          </form>

          {error && <AlertBanner variant="error" message={error} />}

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Spinner size="md" />
            </div>
          )}

          {!loading && searched && clients !== null && (
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <p className="text-sm font-medium text-foreground">
                  {clients.length === 0 ? 'Nenhum cliente encontrado' : `${clients.length} cliente${clients.length !== 1 ? 's' : ''}`}
                </p>
              </div>

              {clients.length === 0 ? (
                <div className="p-5">
                  <EmptyState icon={<Users className="h-5 w-5" />} title="Nenhum resultado" description="Nenhum resultado para esta busca." />
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="grid gap-2 p-3 md:hidden">
                    {clients.map((client) => (
                      <Link
                        key={client.id}
                        to={`/clients/${client.id}`}
                        className="rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted"
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{client.nome_cliente}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{client.documento || 'Sem documento'}</p>
                          </div>
                          <span className="ml-2 text-sm font-bold text-[hsl(var(--success))]">{client.pontos_disponiveis ?? 0} pts</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          {statusBadge(getClientStatus(client))}
                          <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>CPF/CNPJ</TableHead>
                          <TableHead>Contato</TableHead>
                          <TableHead className="text-right">Pontos</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="w-[80px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clients.map((client) => (
                          <TableRow key={client.id}>
                            <TableCell className="font-medium text-foreground">{client.nome_cliente}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{client.documento || '—'}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              <div>{client.email || '—'}</div>
                              <div>{client.telefone || ''}</div>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-[hsl(var(--success))]">{client.pontos_disponiveis ?? 0}</TableCell>
                            <TableCell className="text-center">{statusBadge(getClientStatus(client))}</TableCell>
                            <TableCell>
                              <Link to={`/clients/${client.id}`} className="text-xs text-primary hover:text-primary/80">Ver →</Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          )}

          {!loading && !searched && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <Search className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-foreground">Busque um cliente</p>
              <p className="mt-1 text-xs text-muted-foreground">Digite o CPF, nome ou ID para localizar rapidamente.</p>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
