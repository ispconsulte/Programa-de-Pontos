import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ShieldAlert, Users } from 'lucide-react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import { statusBadge } from '@/components/Badge'
import { apiFetch, getApiErrorMessage, getDisplayError } from '@/lib/api-client'
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

interface Contract {
  id: string | number
  plano?: string
  status?: string
  situacao_financeira?: string
  situacao_financeira_contrato?: string
  data_ativacao?: string
  pago_ate?: string
  [key: string]: unknown
}

interface ClientDetail {
  id: string | number
  nome?: string
  razao?: string
  cpf_cnpj?: string
  email?: string
  telefone?: string
  celular?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  cep?: string
  ativo?: string | boolean
  status?: string
  contratos?: Contract[]
  contracts?: Contract[]
  [key: string]: unknown
}

interface ClientResponse {
  data?: ClientDetail
  cliente?: ClientDetail
  contratos?: Contract[]
  contracts?: Contract[]
  [key: string]: unknown
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('pt-BR')
}

function buildAddress(client: ClientDetail): string {
  const parts = [
    client.endereco,
    client.numero ? `n ${client.numero}` : null,
    client.complemento,
    client.bairro,
    client.cidade,
    client.estado,
    client.cep,
  ].filter(Boolean)
  return parts.join(', ') || '-'
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm text-slate-100">{children || '-'}</div>
    </div>
  )
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await apiFetch(`/clients/${id}`)
        if (!res.ok) {
          setError(await getApiErrorMessage(res, 'Cliente não encontrado.'))
          return
        }

        const json: ClientResponse = await res.json()
        const currentClient = json.data || json.cliente || (json as unknown as ClientDetail)
        const currentContracts = currentClient.contratos || currentClient.contracts || json.contratos || json.contracts || []

        setClient(currentClient)
        setContracts(currentContracts as Contract[])
      } catch (err) {
        setError(getDisplayError(err, 'Erro ao carregar cliente.'))
      } finally {
        setLoading(false)
      }
    }

    if (id) void fetchData()
  }, [id])

  const clientName = client?.nome || client?.razao || 'Cliente'
  const clientPhone = client?.telefone || client?.celular || '-'
  const clientStatus = client?.ativo ?? client?.status ?? '-'

  return (
    <ProtectedRoute>
      <Layout>
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6">
            <Button variant="outline" size="sm" asChild>
              <Link to="/clients">
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </Link>
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 flex-shrink-0 text-destructive" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            </div>
          ) : client ? (
            <div className="space-y-6">
              <PageHeader
                icon={Users}
                title={clientName}
                subtitle={`ID #${client.id}`}
                actions={statusBadge(String(clientStatus))}
              />

              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Informações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Nome">{clientName}</Field>
                      <Field label="Email">{client.email || '-'}</Field>
                      <Field label="Telefone">{clientPhone}</Field>
                      <Field label="CPF/CNPJ">{client.cpf_cnpj || '-'}</Field>
                      <div className="sm:col-span-2">
                        <Field label="Endereço">{buildAddress(client)}</Field>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Resumo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Contratos">
                        <span className="text-lg font-bold">{contracts.length}</span>
                      </Field>
                      <Field label="Status">
                        {statusBadge(String(clientStatus))}
                      </Field>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Contratos</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {contracts.length === 0 ? (
                    <div className="py-16 text-center">
                      <p className="text-sm text-muted-foreground">Nenhum contrato encontrado.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Situação financeira</TableHead>
                          <TableHead>Ativação</TableHead>
                          <TableHead>Pago até</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contracts.map((contract, index) => (
                          <TableRow key={contract.id ?? index}>
                            <TableCell className="font-mono text-xs text-white">{contract.id ?? '-'}</TableCell>
                            <TableCell className="text-slate-300">{contract.plano || '-'}</TableCell>
                            <TableCell>{contract.status ? statusBadge(contract.status) : '-'}</TableCell>
                            <TableCell className="text-slate-300">
                              {contract.situacao_financeira || contract.situacao_financeira_contrato || '-'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-slate-300">{formatDate(contract.data_ativacao)}</TableCell>
                            <TableCell className="whitespace-nowrap text-slate-300">{formatDate(contract.pago_ate)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
