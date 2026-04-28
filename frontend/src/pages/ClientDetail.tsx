import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ShieldAlert, Users, Mail, Phone, FileText, Hash, Briefcase, Coins, Gift, TrendingUp } from 'lucide-react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import { statusBadge } from '@/components/Badge'
import {
  fetchCampaignClientById,
  fetchCampaignClientFaturas,
  resolveCurrentTenant,
  type CampaignClientRow,
  type ReceivableRow,
} from '@/lib/supabase-queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { friendlyError } from '@/lib/friendly-errors'
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

function InfoField({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="mt-0.5 truncate text-sm text-foreground">{children || '-'}</div>
      </div>
    </div>
  )
}

function PointCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border p-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{value.toLocaleString('pt-BR')}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/[0.05]">
          <Icon className="h-5 w-5 text-foreground/50" />
        </div>
      </div>
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
        const resolved = await resolveCurrentTenant()
        if (resolved.error === 'no_session') { setError('Sessão expirada. Saia e entre novamente.'); return }
        if (resolved.error === 'no_user_record') { setError('Sessão inválida ou usuário sem cadastro. Saia e entre novamente.'); return }
        if (resolved.error === 'no_tenant' && !resolved.isFullAdmin) { setError('Usuário não associado a um tenant.'); return }
        const tenantId = resolved.tenantId!
        if (!id) { setError('ID inválido.'); return }

        const [clientData, faturasData] = await Promise.all([
          fetchCampaignClientById(tenantId, id),
          fetchCampaignClientFaturas(tenantId, id),
        ])

        if (!clientData) { setError('Cliente não encontrado.'); return }
        setClient(clientData)
        setFaturas(faturasData)
      } catch (err) {
        setError(friendlyError(err, { action: 'load' }))
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

              {/* Points summary */}
              <div className="grid gap-4 sm:grid-cols-3">
                <PointCard label="Acumulados" value={client.pontos_acumulados} icon={TrendingUp} color="border-emerald-500/20 bg-emerald-500/[0.04]" />
                <PointCard label="Resgatados" value={client.pontos_resgatados} icon={Gift} color="border-amber-500/20 bg-amber-500/[0.04]" />
                <PointCard label="Disponíveis" value={client.pontos_disponiveis ?? 0} icon={Coins} color="border-primary/20 bg-primary/[0.04]" />
              </div>

              {/* Client info */}
              <Card>
                <CardHeader><CardTitle>Informações do cliente</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <InfoField icon={Users} label="Nome">{client.nome_cliente}</InfoField>
                    <InfoField icon={Mail} label="E-mail">{client.email || '-'}</InfoField>
                    <InfoField icon={Phone} label="Telefone">{client.telefone || '-'}</InfoField>
                    <InfoField icon={FileText} label="CPF/CNPJ">{client.documento || '-'}</InfoField>
                    <InfoField icon={Hash} label="ID IXC">{client.ixc_cliente_id}</InfoField>
                    <InfoField icon={Briefcase} label="Contrato IXC">{client.ixc_contrato_id || '-'}</InfoField>
                  </div>
                </CardContent>
              </Card>

              {/* Faturas */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Faturas processadas</CardTitle>
                    <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{faturas.length}</span>
                  </div>
                </CardHeader>
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
                          <TableHead className="text-center">Status</TableHead>
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
                            <TableCell className="text-center">{statusBadge(fatura.status_processamento)}</TableCell>
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
