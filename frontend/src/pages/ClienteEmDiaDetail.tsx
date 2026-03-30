import Layout from '@/components/Layout'
import RegisterRedemptionDialog from '@/components/RegisterRedemptionDialog'
import EmptyState from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useClienteEmDia } from '@/hooks/useClienteEmDia'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Gift, Plus, Settings, Star } from 'lucide-react'

export default function ClienteEmDiaDetailPage() {
  const { ixc_cliente_id } = useParams()
  const { loading, error, customerDetail, rewards } = useClienteEmDia({
    customerId: ixc_cliente_id,
  })
  const customer = customerDetail?.customer ?? null

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/cliente-em-dia" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            Cliente em Dia
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Detalhe do cliente</span>
        </div>

        <Card className="overflow-hidden border-emerald-500/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(8,10,15,0)_46%),hsl(var(--surface-1))]">
          <CardContent className="p-5 lg:p-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                  <Star className="h-7 w-7 text-emerald-300" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white lg:text-[30px]">
                    {customer?.nomeCliente ?? `Cliente #${ixc_cliente_id ?? '...'}`}
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {loading
                      ? 'Carregando dados reais do cliente.'
                      : error
                        ? error
                        : customer?.documento ?? 'Nenhum documento vinculado.'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
                      IXC #{customer?.ixcClienteId ?? ixc_cliente_id ?? '...'}
                    </span>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
                      Status: {customer?.statusCampanha ?? 'sem dados'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="min-w-[250px] rounded-2xl border border-emerald-500/15 bg-black/10 p-5 text-right backdrop-blur-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Pontos disponiveis
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  {customer ? customer.pontosDisponiveis.toLocaleString('pt-BR') : '--'}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {customer?.ultimaSincronizacaoEm
                    ? `Atualizado em ${new Date(customer.ultimaSincronizacaoEm).toLocaleString('pt-BR')}`
                    : 'Ainda nao ha sincronizacao registrada.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button className="bg-emerald-600 text-white hover:bg-emerald-500" disabled>
            <Plus className="h-3.5 w-3.5" />
            Adicionar pontos manualmente
          </Button>
          <RegisterRedemptionDialog
            defaultCustomerId={customer?.ixcClienteId}
            customers={customer ? [{
              id: customer.ixcClienteId,
              name: customer.nomeCliente,
              availablePoints: customer.pontosDisponiveis,
            }] : []}
            gifts={rewards.filter((reward) => reward.ativo).map((reward) => ({
              id: reward.id,
              name: reward.nome,
              requiredPoints: reward.pontosNecessarios,
            }))}
            trigger={
              <Button variant="outline" className="border-white/[0.08]">
                <Gift className="h-3.5 w-3.5" />
                Registrar resgate
              </Button>
            }
          />
          <Button variant="outline" className="border-white/[0.08]" disabled>
            <Settings className="h-3.5 w-3.5" />
            Alterar status da campanha
          </Button>
        </div>

        <Card>
          <CardContent className="p-5">
            {loading ? (
              <EmptyState title="Carregando dados" description="Buscando o resumo do cliente no Supabase." />
            ) : error ? (
              <EmptyState title="Falha ao carregar dados" description={error} />
            ) : !customer ? (
              <EmptyState title="Nenhum dado encontrado" description="Este cliente ainda nao foi sincronizado para a campanha." />
            ) : (
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Pontos acumulados</p>
                  <p className="mt-2 text-lg font-semibold text-white">{customer.pontosAcumulados}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Pontos resgatados</p>
                  <p className="mt-2 text-lg font-semibold text-white">{customer.pontosResgatados}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">E-mail</p>
                  <p className="mt-2 text-sm font-medium text-white">{customer.email ?? 'Nao informado'}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Telefone</p>
                  <p className="mt-2 text-sm font-medium text-white">{customer.telefone ?? 'Nao informado'}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Timeline da campanha</CardTitle>
              <CardDescription>
                Historico de pontuacao, upgrades e resgates do cliente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <EmptyState title="Carregando timeline" description="Buscando historico real do cliente." />
              ) : error ? (
                <EmptyState title="Falha ao carregar dados" description={error} />
              ) : !customerDetail || customerDetail.historico.length === 0 ? (
                <EmptyState title="Ainda nao ha registros aqui" description="Nenhuma movimentacao foi registrada para este cliente." />
              ) : (
                <div className="space-y-3">
                  {customerDetail.historico.map((item) => (
                    <div key={item.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-white">{item.descricao}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{item.origem}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-300">
                            {item.pontosMovimentados > 0 ? '+' : ''}{item.pontosMovimentados} pts
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historico de resgates</CardTitle>
              <CardDescription>
                Beneficios utilizados pelo cliente com acompanhamento de entrega ou aplicacao.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <EmptyState title="Carregando resgates" description="Buscando resgates reais do cliente." />
              ) : error ? (
                <EmptyState title="Falha ao carregar dados" description={error} />
              ) : !customerDetail || customerDetail.resgates.length === 0 ? (
                <EmptyState title="Ainda nao ha registros aqui" description="Nenhum resgate foi registrado para este cliente." />
              ) : (
                <div className="space-y-3">
                  {customerDetail.resgates.map((item) => (
                    <div key={item.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-white">{item.status}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{item.observacoes ?? 'Sem observacoes'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-white">{item.pontosResgatados} pts</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(item.solicitadoEm).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
