import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import RegisterRedemptionDialog from '@/components/RegisterRedemptionDialog'
import ManualPointsDialog from '@/components/ManualPointsDialog'
import EmptyState from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useClienteEmDia } from '@/hooks/useClienteEmDia'
import { fetchCurrentUserProfile, isAdminUiRole } from '@/lib/user-management'
import { Link, useParams, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronRight, Gift, Settings, Star } from 'lucide-react'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function friendlyOrigem(raw: string): string {
  if (!raw || raw === 'sistema') return 'Sistema'
  if (UUID_RE.test(raw)) return 'Ajuste manual do administrador'
  const map: Record<string, string> = {
    sync_ixc_pagamentos: 'Pagamento detectado via IXC',
    sync_ixc_contratos: 'Sincronização de contrato IXC',
    manual: 'Ajuste manual',
    resgate: 'Resgate de brinde',
    admin: 'Administrador',
  }
  return map[raw] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function ClienteEmDiaDetailPage() {
  const { ixc_cliente_id } = useParams()
  const { loading, error, customerDetail, reload } = useClienteEmDia({
    customerId: ixc_cliente_id,
  })
  const customer = customerDetail?.customer ?? null
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    void fetchCurrentUserProfile()
      .then((profile) => setIsAdmin(isAdminUiRole(profile.role)))
      .catch(() => setIsAdmin(false))
  }, [])

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/operacao" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            Operação
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
                    <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-1">
                      IXC #{customer?.ixcClienteId ?? ixc_cliente_id ?? '...'}
                    </span>
                    <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-1">
                      Status: {customer?.statusCampanha ?? 'sem dados'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="min-w-[250px] rounded-2xl border border-emerald-500/15 bg-[hsl(var(--surface-2))] p-5 text-right">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Pontos disponiveis
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                  {customer ? customer.pontosDisponiveis.toLocaleString('pt-BR') : '--'}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {customer?.ultimaSincronizacaoEm
                    ? `Atualizado em ${new Date(customer.ultimaSincronizacaoEm).toLocaleString('pt-BR')}`
                    : 'Ainda não há sincronização registrada.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <ManualPointsDialog
              client={customer ? {
                id: customer.id,
                ixc_cliente_id: customer.ixcClienteId,
                ixc_contrato_id: customer.ixcContratoId,
                nome_cliente: customer.nomeCliente,
                documento: customer.documento,
                email: customer.email,
                telefone: customer.telefone,
                status: customer.statusCampanha,
                pontos_acumulados: customer.pontosAcumulados,
                pontos_resgatados: customer.pontosResgatados,
                pontos_disponiveis: customer.pontosDisponiveis,
                ultima_sincronizacao_em: customer.ultimaSincronizacaoEm,
                metadata: customer.metadata,
                created_at: customer.createdAt,
                updated_at: customer.updatedAt,
              } : null}
              onCompleted={reload}
            />
          )}
          <RegisterRedemptionDialog
            preselectedClient={customer ? {
              id: customer.id,
              ixc_cliente_id: customer.ixcClienteId,
              ixc_contrato_id: customer.ixcContratoId,
              nome_cliente: customer.nomeCliente,
              documento: customer.documento,
              email: customer.email,
              telefone: customer.telefone,
              status: customer.statusCampanha,
              pontos_acumulados: customer.pontosAcumulados,
              pontos_resgatados: customer.pontosResgatados,
              pontos_disponiveis: customer.pontosDisponiveis,
              ultima_sincronizacao_em: customer.ultimaSincronizacaoEm,
              metadata: customer.metadata,
              created_at: customer.createdAt,
              updated_at: customer.updatedAt,
            } : null}
            onRedemptionComplete={reload}
            trigger={
              <Button variant="outline" className="border-[hsl(var(--border))]">
                <Gift className="h-3.5 w-3.5" />
                Registrar resgate
              </Button>
            }
          />
          <Button variant="outline" className="border-[hsl(var(--border))]" disabled>
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
              <EmptyState title="Nenhum dado encontrado" description="Este cliente ainda não foi sincronizado para a campanha." />
            ) : (
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Pontos acumulados</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{customer.pontosAcumulados}</p>
                </div>
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Pontos resgatados</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{customer.pontosResgatados}</p>
                </div>
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">E-mail</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{customer.email ?? 'Não informado'}</p>
                </div>
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Telefone</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{customer.telefone ?? 'Não informado'}</p>
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
                Histórico de pontuação, upgrades e resgates do cliente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <EmptyState title="Carregando timeline" description="Buscando historico real do cliente." />
              ) : error ? (
                <EmptyState title="Falha ao carregar dados" description={error} />
              ) : !customerDetail || customerDetail.historico.length === 0 ? (
                <EmptyState title="Ainda não há registros aqui" description="Nenhuma movimentação foi registrada para este cliente." />
              ) : (
                <div className="space-y-3">
                  {customerDetail.historico.map((item) => {
                    const isDebit = item.pontosMovimentados < 0
                    return (
                      <div key={item.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{item.descricao}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{friendlyOrigem(item.origem)}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`text-sm font-semibold ${isDebit ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {item.pontosMovimentados > 0 ? '+' : ''}{item.pontosMovimentados} pts
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(item.createdAt).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
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
                <EmptyState title="Ainda não há registros aqui" description="Nenhum resgate foi registrado para este cliente." />
              ) : (
                <div className="space-y-3">
                  {customerDetail.resgates.map((item) => {
                    const statusMap: Record<string, string> = {
                      pendente: 'Pendente',
                      aprovado: 'Aprovado',
                      entregue: 'Entregue',
                      cancelado: 'Cancelado',
                    }
                    return (
                      <div key={item.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{item.brindeNome}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {statusMap[item.status] ?? item.status}
                              {item.responsavelEntrega ? ` · Entregue por ${item.responsavelEntrega}` : ''}
                            </p>
                            {item.observacoes && (
                              <p className="mt-1 text-xs text-muted-foreground/70 italic">{item.observacoes}</p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-rose-400">-{item.pontosResgatados} pts</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(item.solicitadoEm).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
