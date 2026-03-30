import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Download, Edit3, Gift, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

const officialHighlights = [
  { label: 'Vigencia oficial', value: '03/2026 a 01/2027' },
  { label: 'Resgate', value: 'Mensal ou acumulado' },
  { label: 'Expiracao dos pontos', value: 'Janeiro/2027' },
]

export default function ClienteEmDiaPage() {
  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          icon={Gift}
          title="Cliente em Dia"
          subtitle="Visao administrativa da campanha de fidelizacao com foco em adimplencia, pontos e saude da base participante."
          actions={
            <>
              <Button asChild variant="outline" size="sm" className="border-white/[0.08]">
                <Link to="/cliente-em-dia/configuracoes">
                  <Settings className="h-3.5 w-3.5" />
                  Configurações
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="border-white/[0.08]">
                <Link to="/cliente-em-dia/brindes">
                  <Edit3 className="h-3.5 w-3.5" />
                  Catálogo de brindes
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="border-white/[0.08]">
                <Link to="/cliente-em-dia/cadastrar">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Cadastro em lote
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-200 hover:bg-emerald-500/[0.08] hover:text-white">
                <Download className="h-3.5 w-3.5" />
                Exportar
              </Button>
            </>
          }
        />

        <Card className="overflow-hidden border-emerald-500/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.10),rgba(8,10,15,0)_46%),hsl(var(--surface-1))]">
          <CardContent className="p-5 lg:p-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/[0.08] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200">
                  Cliente em Dia
                </div>
                <h2 className="mt-4 text-2xl font-bold tracking-tight text-white lg:text-[30px]">
                  Campanha estruturada e pronta para receber dados reais
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  As regras oficiais, a navegacao e os fluxos administrativos ja estao organizados. Os indicadores abaixo aguardam sincronizacao com dados reais do sistema.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[430px]">
                {officialHighlights.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/[0.06] bg-black/10 px-4 py-4 backdrop-blur-sm">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Indicadores da campanha</CardTitle>
              <CardDescription>
                Esta area exibira clientes participantes, pontos distribuidos, resgates pendentes e percentual de pagamento antecipado quando houver sincronizacao.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState title="Nenhum dado encontrado" description="Nao foi possivel encontrar dados no momento." />
            </CardContent>
          </Card>

          <Card className="border-emerald-500/10">
            <CardHeader>
              <CardTitle>Leitura operacional</CardTitle>
              <CardDescription>
                Resumo rapido para apoiar acompanhamento gerencial e decisao administrativa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState title="Ainda nao ha registros aqui" description="Nenhum resultado encontrado. Tente novamente mais tarde." />
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-white/[0.06]">
            <CardTitle>Clientes da campanha</CardTitle>
            <CardDescription>
              Esta tabela sera preenchida com clientes, status da campanha, pontos disponiveis e ultima movimentacao assim que houver dados reais.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <EmptyState title="Ainda nao ha registros aqui" description="Nao foi possivel encontrar dados no momento." />
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
