import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import StatCard from '@/components/StatCard'
import EmptyState from '@/components/EmptyState'
import AlertBanner from '@/components/AlertBanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useClienteEmDia } from '@/hooks/useClienteEmDia'
import { CheckCircle2, Download, Edit3, Gift, Settings, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ClienteEmDiaPage() {
  const { loading, error, overview } = useClienteEmDia()
  const activeCustomers = overview.filter((item) => item.statusCampanha === 'ativo').length
  const blockedCustomers = overview.filter((item) => item.statusCampanha === 'bloqueado').length
  const totalAvailablePoints = overview.reduce((sum, item) => sum + item.pontosDisponiveis, 0)

  return (
    <Layout>
      <div className="page-stack">
        <PageHeader
          icon={Gift}
          title="Cliente em Dia"
          subtitle="Visão administrativa da campanha de fidelização com foco em adimplência, pontos e saúde da base participante."
          actions={
            <>
              <Button asChild variant="outline" size="sm">
                <Link to="/cliente-em-dia/configuracoes">
                  <Settings className="h-3.5 w-3.5" />
                  Configurações
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/cliente-em-dia/brindes">
                  <Edit3 className="h-3.5 w-3.5" />
                  Catálogo de brindes
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/cliente-em-dia/cadastrar">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Cadastro em lote
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="border-[hsl(var(--success)/0.2)] bg-[hsl(var(--success)/0.04)] text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.08)]">
                <Download className="h-3.5 w-3.5" />
                Exportar
              </Button>
            </>
          }
        />

        {/* Campaign hero */}
        <Card className="overflow-hidden border-[hsl(var(--success)/0.1)] bg-[linear-gradient(135deg,hsl(var(--success)/0.08),transparent_46%),hsl(var(--surface-1))]">
          <CardContent className="p-5 lg:p-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--success)/0.15)] bg-[hsl(var(--success)/0.08)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--success))]">
                  Cliente em Dia
                </div>
                <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground lg:text-[28px]">
                  Campanha estruturada e pronta para receber dados reais
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  As regras oficiais, a navegação e os fluxos administrativos já estão organizados. Os indicadores abaixo aguardam sincronização com dados reais.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        {!loading && !error && overview.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Clientes na campanha" value={overview.length} icon={Users} />
            <StatCard label="Clientes ativos" value={activeCustomers} icon={CheckCircle2} iconColor="text-[hsl(var(--success))]" iconBg="bg-[hsl(var(--success)/0.1)]" />
            <StatCard label="Pontos disponíveis" value={totalAvailablePoints.toLocaleString('pt-BR')} icon={Gift} iconColor="text-[hsl(var(--warning))]" iconBg="bg-[hsl(var(--warning)/0.1)]" />
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Indicadores da campanha</CardTitle>
              <CardDescription>
                Clientes participantes, pontos distribuídos, resgates pendentes e percentual de pagamento antecipado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <EmptyState title="Carregando dados" description="Consultando os dados reais no Supabase." />
              ) : error ? (
                <AlertBanner variant="error" message={error} />
              ) : overview.length === 0 ? (
                <EmptyState title="Nenhum dado encontrado" description="Ainda não existem clientes sincronizados na campanha." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="surface-inset rounded-xl px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Clientes bloqueados</p>
                    <p className="mt-2 text-xl font-semibold text-foreground">{blockedCustomers}</p>
                  </div>
                  <div className="surface-inset rounded-xl px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Última sincronização</p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {overview[0]?.ultimaSincronizacaoEm
                        ? new Date(overview[0].ultimaSincronizacaoEm).toLocaleString('pt-BR')
                        : 'Sem sincronização registrada'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leitura operacional</CardTitle>
              <CardDescription>
                Resumo rápido para acompanhamento gerencial e decisão administrativa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <EmptyState title="Carregando" description="Consolidando os dados atuais." />
              ) : error ? (
                <AlertBanner variant="error" message={error} />
              ) : (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>A campanha está organizada e pronta para receber dados sincronizados do sistema IXC.</p>
                  <p>Quando houver dados reais, os indicadores serão atualizados automaticamente.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Customers list */}
        <Card>
          <CardHeader className="border-b border-[hsl(var(--border))]">
            <CardTitle>Clientes da campanha</CardTitle>
            <CardDescription>
              Clientes, status, pontos disponíveis e última movimentação.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-5">
                <EmptyState title="Carregando clientes" description="Buscando clientes sincronizados." />
              </div>
            ) : error ? (
              <div className="p-5">
                <AlertBanner variant="error" message={error} />
              </div>
            ) : overview.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Ainda não há registros" description="Nenhum cliente sincronizado foi encontrado." />
              </div>
            ) : (
              <div className="divide-y divide-[hsl(var(--border))]">
                {overview.slice(0, 8).map((customer) => (
                  <Link
                    key={customer.id}
                    to={`/cliente-em-dia/${customer.ixcClienteId}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[hsl(var(--muted))]"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{customer.nomeCliente}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">IXC #{customer.ixcClienteId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{customer.statusCampanha}</p>
                      <p className="mt-0.5 text-sm font-semibold text-[hsl(var(--success))]">{customer.pontosDisponiveis} pts</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
