import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Coins, ShieldAlert } from 'lucide-react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import { categoryBadge, statusBadge } from '@/components/Badge'
import { fetchReceivableById, getCurrentTenantId, type ReceivableRow } from '@/lib/supabase-queries'
import { getCampaignRuleLabel, getPaymentBehaviorLabel, getPaymentScore } from '@/lib/receivables-utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Não encontrado'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === '0000-00-00') return 'Não encontrado'
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  if (Number.isNaN(d.getTime())) return 'Não encontrado'
  return d.toLocaleDateString('pt-BR')
}

function formatText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return 'Não encontrado'
  const text = String(value).trim()
  if (!text || text === '-' || text === '0') return 'Não encontrado'
  return text
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm text-slate-100">{children || '-'}</div>
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
  const campaignBehavior = shaped ? getPaymentBehaviorLabel(shaped) : 'Não encontrado'
  const campaignRule = getCampaignRuleLabel(campaignPoints)
  const cliente = row?.pontuacao_campanha_clientes
  const payload = (row?.payload ?? {}) as Record<string, unknown>

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
                <p className="text-sm text-red-300">{error}</p>
              </div>
            </div>
          ) : row && shaped ? (
            <div className="space-y-6">
              <PageHeader
                icon={Coins}
                title={cliente?.nome_cliente ?? `Recebimento ${row.fatura_id}`}
                subtitle={`Fatura IXC #${row.fatura_id} • ${row.ixc_contrato_id ? `Contrato #${row.ixc_contrato_id}` : 'Sem contrato'}`}
                actions={
                  <div className="flex gap-2">
                    {statusBadge(row.status_processamento)}
                    {row.status_processamento === 'ignorado' ? categoryBadge('renegociado') : null}
                  </div>
                }
              />

              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <Card>
                  <CardHeader><CardTitle>Dados do recebimento</CardTitle></CardHeader>
                  <CardContent>
                    <div className="mb-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Recebido</p>
                        <p className="mt-2 text-xl font-semibold text-emerald-400">{formatBRL(row.valor_pago)}</p>
                      </div>
                      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Vencimento</p>
                        <p className="mt-2 text-xl font-semibold text-foreground">{formatDate(row.competencia)}</p>
                      </div>
                      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pagamento</p>
                        <p className="mt-2 text-xl font-semibold text-foreground">{formatDate(row.data_pagamento)}</p>
                      </div>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Cliente">{formatText(cliente?.nome_cliente)}</Field>
                      <Field label="Fatura IXC">{formatText(row.fatura_id)}</Field>
                      <Field label="ID contrato IXC">{formatText(row.ixc_contrato_id)}</Field>
                      <Field label="Vencimento">{formatDate(row.competencia)}</Field>
                      <Field label="Pagamento">{formatDate(row.data_pagamento)}</Field>
                      <Field label="Valor recebido"><span className="text-emerald-400">{formatBRL(row.valor_pago)}</span></Field>
                      <Field label="Status">{statusBadge(row.status_processamento)}</Field>
                      <Field label="Categoria IXC">{formatText(payload['categoria_ixc'])}</Field>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-5">
                  <Card>
                    <CardHeader><CardTitle>Resultado da campanha</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field label="Faixa aplicada">{campaignBehavior}</Field>
                        <Field label="Pontos gerados">
                          <span className="text-emerald-400">{campaignPoints > 0 ? `+${campaignPoints} pontos` : formatText(row.pontos_gerados > 0 ? `+${row.pontos_gerados}` : null)}</span>
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label="Regra utilizada">{campaignRule}</Field>
                        </div>
                        <Field label="Status da campanha">
                          {campaignPoints > 0 ? categoryBadge('recebido') : 'Não encontrado'}
                        </Field>
                        <Field label="Elegível para resgate">
                          {campaignPoints > 0 ? 'Sim, após acumulação mínima' : 'Não identificado'}
                        </Field>
                      </div>
                    </CardContent>
                  </Card>

                  {cliente && (
                    <Card>
                      <CardHeader><CardTitle>Cliente</CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid gap-5 sm:grid-cols-2">
                          <Field label="Nome">{formatText(cliente.nome_cliente)}</Field>
                          <Field label="CPF/CNPJ">{formatText(cliente.documento)}</Field>
                          <Field label="Email">{formatText(cliente.email)}</Field>
                          <Field label="Telefone">{formatText(cliente.telefone)}</Field>
                        </div>
                        {row.campanha_cliente_id && (
                          <div className="mt-5 border-t border-[hsl(var(--border))] pt-4">
                            <Link
                              to={`/clients/${row.campanha_cliente_id}`}
                              className="inline-flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-primary/80"
                            >
                              Ver perfil do cliente
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
