import Layout from '@/components/Layout'
import RegisterRedemptionDialog from '@/components/RegisterRedemptionDialog'
import EmptyState from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Gift, Plus, Settings, Star } from 'lucide-react'

export default function ClienteEmDiaDetailPage() {
  const { ixc_cliente_id } = useParams()

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
                    Cliente #{ixc_cliente_id ?? '...'}
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nao foi possivel encontrar dados no momento.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
                      IXC #{ixc_cliente_id ?? '...'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="min-w-[250px] rounded-2xl border border-emerald-500/15 bg-black/10 p-5 text-right backdrop-blur-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Pontos disponiveis
                </p>
                <p className="mt-3 text-sm font-medium tracking-tight text-muted-foreground">
                  Nenhum dado encontrado
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Ainda nao ha registros aqui.
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
            <EmptyState title="Nenhum dado encontrado" description="Nao foi possivel encontrar dados no momento." />
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
              <EmptyState title="Ainda nao ha registros aqui" description="Nao foi possivel encontrar dados no momento." />
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
              <EmptyState title="Ainda nao ha registros aqui" description="Nao foi possivel encontrar dados no momento." />
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
