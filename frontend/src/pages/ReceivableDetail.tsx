import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Coins, ShieldAlert, Users, Mail, Phone, FileText, Hash, Briefcase, TrendingUp, Gift, CalendarDays, Receipt } from 'lucide-react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import { categoryBadge, statusBadge } from '@/components/Badge'
import {
  fetchReceivableById,
  fetchCampaignClientByIxcClienteId,
  fetchRecentFaturasByIxcClienteId,
  getCurrentTenantId,
  type ReceivableRow,
  type CampaignClientRow,
} from '@/lib/supabase-queries'
import { getCampaignRuleLabel, getPaymentBehaviorLabel, getPaymentScore } from '@/lib/receivables-utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === '0000-00-00') return '-'
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('pt-BR')
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

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${color || 'text-foreground'}`}>{value}</p>
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

/* Adapt DB row to the shape getPaymentScore/getPaymentBehaviorLabel expects */
function toScoreShape(row: ReceivableRow) {
  const payload = (row.payload ?? {}) as Record<string, unknown>
  return {
    id: row.id,
    id_cliente: row.ixc_cliente_id,
    data_vencimento: (payload.competencia as string | undefined) ?? row.competencia ?? '',
    data_pagamento: row.data_pagamento ?? null,
    valor: row.valor_pago ?? 0,
    valor_recebido: row.valor_pago ?? 0,
    categoria: row.status_processamento,
    categoria_codigo: row.status_processamento,
    pontos_gerados: row.pontos_gerados,
  }
}

export default function ReceivableDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [row, setRow] = useState<ReceivableRow | null>(null)
  const [cliente, setCliente] = useState<CampaignClientRow | null>(null)
  const [recentFaturas, setRecentFaturas] = useState<ReceivableRow[]>([])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError('')
      try {
        const tenantId = await getCurrentTenantId()
        if (!tenantId) { setError('Usuário não associado a um tenant.'); return }
        if (!id) { setError('ID inválido.'); return }

        const data = await fetchReceivableById(tenantId, id)
        if (!data) { setError('Recebimento não encontrado.'); return }
        setRow(data)

        // Fetch client and recent invoices in parallel
        const [clientData, faturas] = await Promise.all([
          fetchCampaignClientByIxcClienteId(tenantId, data.ixc_cliente_id),
          fetchRecentFaturasByIxcClienteId(tenantId, data.ixc_cliente_id),
        ])
        setCliente(clientData)
        setRecentFaturas(faturas.filter(f => f.id !== data.id)) // exclude current
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar recebimento.')
      } finally {
        setLoading(false)
      }
    }

    if (id) void fetchData()
  }, [id])

  const shaped = row ? toScoreShape(row) : null
  const campaignPoints = shaped ? getPaymentScore(shaped) : 0
  const campaignBehavior = shaped ? getPaymentBehaviorLabel(shaped) : '-'
  const campaignRule = getCampaignRuleLabel(campaignPoints)

  return (
    <ProtectedRoute>
      <Layout>
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6">
            <Button variant="outline" size="sm" asChild>
              <Link to="/receivables"><ArrowLeft className="h-3.5 w-3.5" />Voltar</Link>
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
          ) : row && shaped ? (
            <div className="space-y-6">
              <PageHeader
                icon={Receipt}
                title={cliente?.nome_cliente ?? `Recebimento ${row.fatura_id}`}
                subtitle={`Fatura IXC #${row.fatura_id} • ${row.ixc_contrato_id ? `Contrato #${row.ixc_contrato_id}` : 'Sem contrato'}`}
                actions={
                  <div className="flex gap-2">
                    {statusBadge(row.status_processamento)}
                  </div>
                }
              />

              {/* Financial summary */}
              <div className="grid gap-4 sm:grid-cols-3">
                <StatBox label="Valor recebido" value={formatBRL(row.valor_pago)} color="text-emerald-400" />
                <StatBox label="Vencimento" value={formatDate(row.competencia)} />
                <StatBox label="Pagamento" value={formatDate(row.data_pagamento)} />
              </div>

              {/* Client points if available */}
              {cliente && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <PointCard label="Acumulados" value={cliente.pontos_acumulados} icon={TrendingUp} color="border-emerald-500/20 bg-emerald-500/[0.04]" />
                  <PointCard label="Resgatados" value={cliente.pontos_resgatados} icon={Gift} color="border-amber-500/20 bg-amber-500/[0.04]" />
                  <PointCard label="Disponíveis" value={cliente.pontos_disponiveis ?? 0} icon={Coins} color="border-primary/20 bg-primary/[0.04]" />
                </div>
              )}

              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                {/* Client info */}
                <Card>
                  <CardHeader><CardTitle>Informações do cliente</CardTitle></CardHeader>
                  <CardContent>
                    {cliente ? (
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <InfoField icon={Users} label="Nome">{cliente.nome_cliente}</InfoField>
                          <InfoField icon={Mail} label="E-mail">{cliente.email || '-'}</InfoField>
                          <InfoField icon={Phone} label="Telefone">{cliente.telefone || '-'}</InfoField>
                          <InfoField icon={FileText} label="CPF/CNPJ">{cliente.documento || '-'}</InfoField>
                          <InfoField icon={Hash} label="ID IXC">{cliente.ixc_cliente_id}</InfoField>
                          <InfoField icon={Briefcase} label="Contrato IXC">{row.ixc_contrato_id || cliente.ixc_contrato_id || '-'}</InfoField>
                        </div>
                        {cliente.id && (
                          <div className="border-t border-border/50 pt-3">
                            <Link
                              to={`/clients/${cliente.id}`}
                              className="inline-flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-primary/80"
                            >
                              Ver perfil completo do cliente
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <InfoField icon={Hash} label="ID Cliente IXC">{row.ixc_cliente_id}</InfoField>
                        <InfoField icon={Briefcase} label="Contrato IXC">{row.ixc_contrato_id || '-'}</InfoField>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Campaign result */}
                <Card>
                  <CardHeader><CardTitle>Resultado da campanha</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoField icon={CalendarDays} label="Faixa aplicada">{campaignBehavior}</InfoField>
                      <InfoField icon={Coins} label="Pontos gerados">
                        <span className="text-emerald-400 font-semibold">
                          {campaignPoints > 0 ? `+${campaignPoints} pontos` : row.pontos_gerados > 0 ? `+${row.pontos_gerados}` : '0'}
                        </span>
                      </InfoField>
                      <div className="sm:col-span-2">
                        <InfoField icon={FileText} label="Regra utilizada">{campaignRule}</InfoField>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Receivable details */}
              <Card>
                <CardHeader><CardTitle>Dados do recebimento</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <InfoField icon={Hash} label="Fatura IXC">{row.fatura_id}</InfoField>
                    <InfoField icon={Briefcase} label="Contrato IXC">{row.ixc_contrato_id || '-'}</InfoField>
                    <InfoField icon={CalendarDays} label="Vencimento">{formatDate(row.competencia)}</InfoField>
                    <InfoField icon={CalendarDays} label="Pagamento">{formatDate(row.data_pagamento)}</InfoField>
                    <InfoField icon={Coins} label="Valor recebido"><span className="text-emerald-400">{formatBRL(row.valor_pago)}</span></InfoField>
                    <InfoField icon={FileText} label="Status">{statusBadge(row.status_processamento)}</InfoField>
                  </div>
                </CardContent>
              </Card>

              {/* Recent invoices from same client */}
              {recentFaturas.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Últimas faturas do cliente</CardTitle>
                      <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{recentFaturas.length}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fatura</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Pontos</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentFaturas.map((fatura) => (
                          <TableRow key={fatura.id}>
                            <TableCell className="font-mono text-xs text-foreground">{fatura.fatura_id}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(fatura.competencia)}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(fatura.data_pagamento)}</TableCell>
                            <TableCell className="text-right text-emerald-400">{formatBRL(fatura.valor_pago)}</TableCell>
                            <TableCell className="text-right font-semibold text-emerald-400">+{fatura.pontos_gerados}</TableCell>
                            <TableCell className="text-center">{statusBadge(fatura.status_processamento)}</TableCell>
                            <TableCell>
                              {fatura.id && (
                                <Link to={`/receivables/${fatura.id}`} className="text-xs text-primary hover:text-primary/80">
                                  Detalhe
                                </Link>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
