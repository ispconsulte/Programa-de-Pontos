import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ShieldAlert, Users } from 'lucide-react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import { statusBadge } from '@/components/Badge'
import {
  fetchCampaignClientById,
  fetchCampaignClientFaturas,
  getCurrentTenantId,
  type CampaignClientRow,
  type ReceivableRow,
} from '@/lib/supabase-queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('pt-BR')
}

function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children || '-'}</div>
    </div>
  )
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [client, setClient] = useState<CampaignClientRow | null>(null)
  const [faturas, setFaturas] = useState<ReceivableRow[]>([])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError('')
      try {
        const tenantId = await getCurrentTenantId()
        if (!tenantId) { setError('Usuário não associado a um tenant.'); return }
        if (!id) { setError('ID inválido.'); return }

        const [clientData, faturasData] = await Promise.all([
          fetchCampaignClientById(tenantId, id),
          fetchCampaignClientFaturas(tenantId, id),
        ])

        if (!clientData) { setError('Cliente não encontrado.'); return }
        setClient(clientData)
        setFaturas(faturasData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar cliente.')
      } finally {
        setLoading(false)
      }
    }

    if (id) void fetchData()
  }, [id])

  return (
    <ProtectedRoute>
      <Layout>
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6">
            <Button variant="outline" size="sm" asChild>
              <Link to="/clients"><ArrowLeft className="h-3.5 w-3.5" />Voltar</Link>
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 flex-shrink-0 text-destructive" />
                <p className="text-sm text-foreground">{error}</p>
              </div>
            </div>
          ) : client ? (
            <div className="space-y-6">
              <PageHeader
                icon={Users}
                title={client.nome_cliente}
                subtitle={`IXC #${client.ixc_cliente_id}`}
                actions={statusBadge(client.status)}
              />

              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Informações</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Nome">{client.nome_cliente}</Field>
                      <Field label="Email">{client.email || '-'}</Field>
                      <Field label="Telefone">{client.telefone || '-'}</Field>
                      <Field label="CPF/CNPJ">{client.documento || '-'}</Field>
                      <Field label="ID IXC">{client.ixc_cliente_id}</Field>
                      <Field label="Contrato IXC">{client.ixc_contrato_id || '-'}</Field>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Pontuação</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid gap-5 sm:grid-cols-3">
                      <Field label="Acumulados">
                        <span className="text-2xl font-bold text-emerald-400">{client.pontos_acumulados}</span>
                      </Field>
                      <Field label="Resgatados">
                        <span className="text-2xl font-bold text-amber-400">{client.pontos_resgatados}</span>
                      </Field>
                      <Field label="Disponíveis">
                        <span className="text-2xl font-bold text-primary">{client.pontos_disponiveis ?? 0}</span>
                      </Field>
                    </div>
                    <div className="mt-5 grid gap-5 sm:grid-cols-2">
                      <Field label="Status">{statusBadge(client.status)}</Field>
                      <Field label="Faturas processadas">
                        <span className="text-lg font-bold">{faturas.length}</span>
                      </Field>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle>Faturas processadas</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {faturas.length === 0 ? (
                    <div className="py-16 text-center">
                      <p className="text-sm text-muted-foreground">Nenhuma fatura processada.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fatura IXC</TableHead>
                          <TableHead>Contrato</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Pontos</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {faturas.map((fatura) => (
                          <TableRow key={fatura.id}>
                            <TableCell className="font-mono text-xs text-foreground">{fatura.fatura_id}</TableCell>
                            <TableCell className="text-muted-foreground">{fatura.ixc_contrato_id || '-'}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(fatura.competencia)}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(fatura.data_pagamento)}</TableCell>
                            <TableCell className="text-right text-emerald-400">{formatBRL(fatura.valor_pago)}</TableCell>
                            <TableCell className="text-right font-semibold text-emerald-400">+{fatura.pontos_gerados}</TableCell>
                            <TableCell>{statusBadge(fatura.status_processamento)}</TableCell>
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
