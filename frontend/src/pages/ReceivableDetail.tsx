import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Coins, ShieldAlert } from 'lucide-react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import { categoryBadge, statusBadge } from '@/components/Badge'
import { apiFetch, getApiErrorMessage, getDisplayError } from '@/lib/api-client'
import { getCampaignRuleLabel, getPaymentBehaviorLabel, getPaymentScore } from '@/lib/receivables-utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ReceivableDetail {
  id: string | number
  id_cliente: string | number
  cliente_nome?: string | null
  id_contrato?: string | number
  data_vencimento: string
  data_pagamento?: string
  valor: string | number
  valor_recebido: string | number
  status: string
  categoria: string
  forma_pagamento?: string
  observacao?: string
  nosso_numero?: string
  linha_digitavel?: string
  descricao?: string | null
  url_boleto?: string | null
  [key: string]: unknown
}

interface ContractData {
  id?: string | number
  status?: string
  situacao_financeira?: string
  situacao_financeira_contrato?: string
  plano?: string
  data_ativacao?: string
  pago_ate?: string
  [key: string]: unknown
}

interface ClientData {
  id?: string | number
  nome?: string
  cpf_cnpj?: string
  email?: string
  telefone?: string
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  ativo?: string | boolean
  [key: string]: unknown
}

interface ReceivableResponse {
  data?: ReceivableDetail
  receivable?: ReceivableDetail
  contrato?: ContractData
  contract?: ContractData
  cliente?: ClientData
  client?: ClientData
  [key: string]: unknown
}

function formatBRL(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return 'Não encontrado'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return 'Não encontrado'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr || dateStr === '0000-00-00' || dateStr === '0000-00-00 00:00:00') return 'Não encontrado'
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  if (Number.isNaN(d.getTime())) return 'Não encontrado'
  return d.toLocaleDateString('pt-BR')
}

function formatText(value: string | number | boolean | null | undefined, options?: { rejectNumericOnly?: boolean }): string {
  if (value === null || value === undefined) return 'Não encontrado'
  const text = String(value).trim()
  if (!text || text === '-' || text === '0' || text.toLowerCase() === 'undefined' || text.toLowerCase() === 'null') {
    return 'Não encontrado'
  }
  if (options?.rejectNumericOnly && /^\d+$/.test(text)) {
    return 'Não encontrado'
  }
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

function shouldShowCategoryBadge(category?: string | null) {
  const normalized = category?.trim().toLowerCase()
  return normalized === 'renegociado' || normalized === 'cancelado'
}

function buildReceivableSubtitle(receivable: ReceivableDetail) {
  const parts = [
    `Recebimento #${formatText(receivable.id)}`,
    formatText(receivable.id_contrato) !== 'Não encontrado' ? `Contrato #${formatText(receivable.id_contrato)}` : null,
    formatDate(receivable.data_vencimento) !== 'Não encontrado' ? `Vencimento ${formatDate(receivable.data_vencimento)}` : null,
  ].filter(Boolean)

  return parts.join(' • ')
}

export default function ReceivableDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [receivable, setReceivable] = useState<ReceivableDetail | null>(null)
  const [contract, setContract] = useState<ContractData | null>(null)
  const [client, setClient] = useState<ClientData | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await apiFetch(`/receivables/${id}`)
        if (!res.ok) {
          setError(await getApiErrorMessage(res, 'Recebimento não encontrado.'))
          return
        }

        const json: ReceivableResponse = await res.json()
        const rec = json.data || json.receivable || (json as unknown as ReceivableDetail)
        const con = json.contrato || json.contract || null
        const cli = json.cliente || json.client || null

        setReceivable(rec)
        setContract(con)
        setClient(cli)

        if (!con && rec?.id_contrato) {
          try {
            const contractRes = await apiFetch(`/contracts/${rec.id_contrato}`)
            if (contractRes.ok) {
              const contractJson = await contractRes.json()
              setContract(contractJson.data || contractJson)
            }
          } catch {
            // ignore
          }
        }
      } catch (err) {
        setError(getDisplayError(err, 'Erro ao carregar recebimento.'))
      } finally {
        setLoading(false)
      }
    }

    if (id) void fetchData()
  }, [id])

  const titleId = receivable ? formatText(receivable.id) : 'Não encontrado'
  const customerName = client?.nome || receivable?.cliente_nome || receivable?.id_cliente
  const displayCustomerName = formatText(customerName)
  const subtitle = receivable ? buildReceivableSubtitle(receivable) : undefined
  const campaignPoints = receivable ? getPaymentScore(receivable) : 0
  const campaignBehavior = receivable ? getPaymentBehaviorLabel(receivable) : 'Não encontrado'
  const campaignRule = getCampaignRuleLabel(campaignPoints)

  return (
    <ProtectedRoute>
      <Layout>
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6">
            <Button variant="outline" size="sm" asChild>
              <Link to="/receivables">
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
          ) : receivable ? (
            <div className="space-y-6">
              <PageHeader
                icon={Coins}
                title={displayCustomerName !== 'Não encontrado' ? displayCustomerName : `Recebimento #${titleId}`}
                subtitle={subtitle}
                actions={
                  <div className="flex gap-2">
                    {statusBadge(receivable.status)}
                    {shouldShowCategoryBadge(receivable.categoria) ? categoryBadge(receivable.categoria) : null}
                  </div>
                }
              />

              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>Dados do recebimento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Recebido</p>
                        <p className="mt-2 text-xl font-semibold text-emerald-400">{formatBRL(receivable.valor_recebido)}</p>
                      </div>
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Vencimento</p>
                        <p className="mt-2 text-xl font-semibold text-white">{formatDate(receivable.data_vencimento)}</p>
                      </div>
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pagamento</p>
                        <p className="mt-2 text-xl font-semibold text-white">{formatDate(receivable.data_pagamento)}</p>
                      </div>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Cliente">{formatText(customerName)}</Field>
                      <Field label="Recebimento">{formatText(receivable.id)}</Field>
                      <Field label="ID contrato">{formatText(receivable.id_contrato)}</Field>
                      <Field label="Vencimento">{formatDate(receivable.data_vencimento)}</Field>
                      <Field label="Pagamento">{formatDate(receivable.data_pagamento)}</Field>
                      <Field label="Valor">{formatBRL(receivable.valor)}</Field>
                      <Field label="Valor recebido"><span className="text-emerald-400">{formatBRL(receivable.valor_recebido)}</span></Field>
                      <Field label="Status">{statusBadge(receivable.status)}</Field>
                      {shouldShowCategoryBadge(receivable.categoria) ? <Field label="Categoria">{categoryBadge(receivable.categoria)}</Field> : null}
                      <Field label="Forma de pagamento">{formatText(receivable.forma_pagamento)}</Field>
                      <Field label="Nosso numero">{formatText(receivable.nosso_numero)}</Field>
                      {formatText(receivable.linha_digitavel) !== 'Não encontrado' && (
                        <div className="sm:col-span-2">
                          <Field label="Linha digitável">
                            <span className="break-all font-mono text-xs">{formatText(receivable.linha_digitavel)}</span>
                          </Field>
                        </div>
                      )}
                      {formatText(receivable.observacao || receivable.descricao) !== 'Não encontrado' && (
                        <div className="sm:col-span-2">
                          <Field label="Observação">{formatText(receivable.observacao || receivable.descricao)}</Field>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-5">
                  <Card>
                    <CardHeader>
                      <CardTitle>Resultado da campanha</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field label="Faixa aplicada">{campaignBehavior}</Field>
                        <Field label="Pontos gerados">
                          <span className="text-emerald-400">{campaignPoints > 0 ? `+${campaignPoints} pontos` : 'Não encontrado'}</span>
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label="Regra utilizada">{campaignRule}</Field>
                        </div>
                        <Field label="Status da campanha">
                          {campaignPoints > 0 ? categoryBadge('recebido') : 'Não encontrado'}
                        </Field>
                        <Field label="Elegivel para resgate">
                          {campaignPoints > 0 ? 'Sim, apos acumulacao minima da campanha' : 'Nao identificado'}
                        </Field>
                      </div>
                    </CardContent>
                  </Card>

                  {contract && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Contrato</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-5 sm:grid-cols-2">
                          <Field label="ID">{formatText(contract.id)}</Field>
                          <Field label="Plano">{formatText(contract.plano)}</Field>
                          <Field label="Status">{contract.status ? statusBadge(contract.status) : 'Não encontrado'}</Field>
                          <Field label="Situação financeira">{formatText(contract.situacao_financeira || contract.situacao_financeira_contrato)}</Field>
                          <Field label="Ativação">{formatDate(contract.data_ativacao)}</Field>
                          <Field label="Pago até">{formatDate(contract.pago_ate)}</Field>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {client && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Cliente</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-5 sm:grid-cols-2">
                          <Field label="Nome">{formatText(client.nome)}</Field>
                          <Field label="CPF/CNPJ">{formatText(client.cpf_cnpj)}</Field>
                          <Field label="Email">{formatText(client.email)}</Field>
                          <Field label="Telefone">{formatText(client.telefone)}</Field>
                          <Field label="Cidade">{formatText(client.cidade, { rejectNumericOnly: true })}</Field>
                          <Field label="Estado">{formatText(client.estado, { rejectNumericOnly: true })}</Field>
                        </div>
                        {client.id && (
                          <div className="mt-5 border-t border-white/[0.04] pt-4">
                            <Link
                              to={`/clients/${client.id}`}
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
