import { useState, useCallback, FormEvent } from 'react'
import { useThrottledAction } from '@/hooks/useThrottledAction'
import { Link } from 'react-router-dom'
import { ArrowRight, RefreshCw, Search, Users } from 'lucide-react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import AlertBanner from '@/components/AlertBanner'
import EmptyState from '@/components/EmptyState'
import { statusBadge } from '@/components/Badge'
import { apiFetch, getApiErrorMessage, getDisplayError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface Client {
  id: string | number
  nome?: string
  razao?: string
  cpf_cnpj?: string
  email?: string
  telefone?: string
  celular?: string
  ativo?: string | boolean
  status?: string
}

interface ClientsResponse {
  data?: Client[]
  clientes?: Client[]
  [key: string]: unknown
}

type SearchType = 'name' | 'cpfCnpj' | 'id'

const SEARCH_TYPES: { value: SearchType; label: string; placeholder: string }[] = [
  { value: 'name', label: 'Nome', placeholder: 'Buscar por nome...' },
  { value: 'cpfCnpj', label: 'CPF/CNPJ', placeholder: 'Buscar por CPF ou CNPJ...' },
  { value: 'id', label: 'ID', placeholder: 'Buscar por ID...' },
]

export default function ClientsPage() {
  const [searchType, setSearchType] = useState<SearchType>('name')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clients, setClients] = useState<Client[] | null>(null)
  const [searched, setSearched] = useState(false)

  const runSearch = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setSearched(true)
    try {
      const params = new URLSearchParams()
      if (searchType === 'name') params.set('name', query.trim())
      else if (searchType === 'cpfCnpj') params.set('cpfCnpj', query.trim())
      else params.set('id', query.trim())

      const res = await apiFetch(`/clients?${params.toString()}`)
      if (!res.ok) {
        setError(await getApiErrorMessage(res, 'Erro ao buscar clientes.'))
        setClients(null)
        return
      }
      const json: ClientsResponse = await res.json()
      const list = json.data || json.clientes || (Array.isArray(json) ? json : [])
      setClients(list as Client[])
    } catch (err) {
      setError(getDisplayError(err, 'Erro ao buscar clientes.'))
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

  const getClientName = (client: Client) => client.nome || client.razao || '—'
  const getClientPhone = (client: Client) => client.telefone || client.celular || '—'
  const getClientStatus = (client: Client) => client.ativo ?? client.status ?? '—'

  return (
    <ProtectedRoute>
      <Layout>
        <PageHeader icon={Users} title="Clientes" subtitle="Base de clientes" />

        <div className="page-stack">
          {/* Search */}
          <Card>
            <CardContent className="p-5">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {SEARCH_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => { setSearchType(type.value); setQuery('') }}
                      className={cn(
                        'rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-all duration-200',
                        searchType === type.value
                          ? 'border-primary/30 bg-primary/10 text-foreground'
                          : 'border-white/[0.06] text-muted-foreground hover:border-white/[0.1] hover:text-foreground'
                      )}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                    <Input
                      type={searchType === 'id' ? 'number' : 'text'}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={SEARCH_TYPES.find((type) => type.value === searchType)?.placeholder}
                      className="pl-10"
                    />
                  </div>
                  <Button type="submit" disabled={loading || !query.trim()}>
                    {loading ? <Spinner size="sm" /> : <Search className="h-3.5 w-3.5" />}
                    Buscar
                  </Button>
                  {searched && (
                    <Button type="button" variant="outline" size="icon" disabled={refreshBusy} onClick={() => void throttledSearch()}>
                      <RefreshCw className={`h-3.5 w-3.5 transition-transform ${refreshBusy ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {error && <AlertBanner variant="error" message={error} />}

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Spinner size="md" />
            </div>
          )}

          {!loading && searched && clients !== null && (
            <Card>
              <div className="border-b border-white/[0.04] px-5 py-4">
                <p className="text-sm font-medium text-foreground">
                  {clients.length === 0
                    ? 'Nenhum cliente encontrado'
                    : `${clients.length} cliente${clients.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <CardContent className="p-0">
                {clients.length === 0 ? (
                  <div className="p-5">
                    <EmptyState icon={<Users className="h-5 w-5" />} title="Nenhum resultado" description="Nenhum resultado para esta busca." />
                  </div>
                ) : (
                  <>
                    {/* Mobile */}
                    <div className="grid gap-2 p-4 md:hidden">
                      {clients.map((client) => (
                        <Link
                          key={client.id}
                          to={`/clients/${client.id}`}
                          className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4 transition-all duration-200 hover:bg-white/[0.03] hover:border-white/[0.08]"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-medium text-foreground">{getClientName(client)}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">ID {client.id}</p>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                            <p>{client.email || 'Sem e-mail'}</p>
                            <p>{getClientPhone(client)}</p>
                          </div>
                          <div className="mt-2">{statusBadge(String(getClientStatus(client)))}</div>
                        </Link>
                      ))}
                    </div>

                    {/* Desktop */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>CPF/CNPJ</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clients.map((client) => (
                            <TableRow key={client.id}>
                              <TableCell className="font-mono text-xs text-foreground">{client.id}</TableCell>
                              <TableCell className="font-medium text-foreground">{getClientName(client)}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">{client.cpf_cnpj || '—'}</TableCell>
                              <TableCell className="text-muted-foreground">{client.email || '—'}</TableCell>
                              <TableCell className="text-muted-foreground">{getClientPhone(client)}</TableCell>
                              <TableCell>{statusBadge(String(getClientStatus(client)))}</TableCell>
                              <TableCell className="text-right">
                                <Link to={`/clients/${client.id}`} className="text-sm text-primary transition-colors hover:text-primary/80">
                                  Ver perfil
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
          )}

          {!loading && !searched && (
            <EmptyState icon={<Search className="h-5 w-5" />} title="Buscar clientes" description="Use a busca acima para localizar clientes." />
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
