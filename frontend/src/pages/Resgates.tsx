import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import RegisterRedemptionDialog from '@/components/RegisterRedemptionDialog'
import EmptyState from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ArrowLeft, CalendarCheck, ChevronRight, Clock, Filter, Gift, Package, Sparkles, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'

type RedemptionStatus = 'elegivel' | 'solicitado' | 'preparo' | 'entregue' | 'ciclo_concluido'

const statusConfig: Record<
  RedemptionStatus,
  { label: string; icon: React.ElementType; color: string; bg: string; ring: string; accent: string; description: string }
> = {
  elegivel: {
    label: 'Elegivel para resgate',
    icon: Gift,
    color: 'text-sky-300',
    bg: 'bg-sky-500/10',
    ring: 'ring-sky-500/20',
    accent: 'border-sky-500/20',
    description: 'Clientes aptos a converter pontos em beneficio.',
  },
  solicitado: {
    label: 'Resgate solicitado',
    icon: Clock,
    color: 'text-amber-300',
    bg: 'bg-amber-500/10',
    ring: 'ring-amber-500/20',
    accent: 'border-amber-500/20',
    description: 'Pedidos recebidos aguardando triagem operacional.',
  },
  preparo: {
    label: 'Em preparacao',
    icon: Package,
    color: 'text-violet-300',
    bg: 'bg-violet-500/10',
    ring: 'ring-violet-500/20',
    accent: 'border-violet-500/20',
    description: 'Itens separados ou beneficios em processamento.',
  },
  entregue: {
    label: 'Entregue',
    icon: Truck,
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/10',
    ring: 'ring-emerald-500/20',
    accent: 'border-emerald-500/20',
    description: 'Resgates concluidos com entrega ao cliente.',
  },
  ciclo_concluido: {
    label: 'Ciclo da campanha concluido',
    icon: CalendarCheck,
    color: 'text-muted-foreground',
    bg: 'bg-[hsl(var(--surface-3))]',
    ring: 'ring-white/[0.08]',
    accent: 'border-[hsl(var(--border))]',
    description: 'Ciclo encerrado e contabilizado na campanha.',
  },
}

const allStatuses: RedemptionStatus[] = ['elegivel', 'solicitado', 'preparo', 'entregue', 'ciclo_concluido']

export default function ResgatesPage() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/cliente-em-dia" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            Cliente em Dia
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Resgates</span>
        </div>

        <PageHeader
          icon={Gift}
          title="Pipeline de Resgates"
          subtitle="Painel operacional para acompanhar elegibilidade, solicitacoes, preparacao, entrega e encerramento do ciclo da campanha."
          actions={
            <>
              <Button variant="outline" size="sm" className="border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-200 hover:bg-emerald-500/[0.08] hover:text-foreground">
                <Filter className="h-3.5 w-3.5" />
                Filtros ativos
              </Button>
              <RegisterRedemptionDialog
                trigger={
                  <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-500">
                    <Sparkles className="h-3.5 w-3.5" />
                    Registrar resgate
                  </Button>
                }
              />
            </>
          }
        />

        <Card className="overflow-hidden border-emerald-500/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(8,10,15,0)_46%),hsl(var(--surface-1))]">
          <CardContent className="p-5 lg:p-6">
            <EmptyState title="Nenhum dado encontrado" description="Não foi possível encontrar dados no momento." />
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-5">
          {allStatuses.map((status) => {
            const config = statusConfig[status]
            const Icon = config.icon

            return (
              <Card key={status} className={cn('min-h-[320px] border-[hsl(var(--border))]', config.accent)}>
                <CardHeader className="border-b border-[hsl(var(--border))] pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl ring-1', config.bg, config.ring)}>
                      <Icon className={cn('h-4 w-4', config.color)} />
                    </div>
                    <span className={cn('inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-bold ring-1', config.bg, config.color, config.ring)}>
                      0
                    </span>
                  </div>
                  <div>
                    <CardTitle className="leading-snug">{config.label}</CardTitle>
                    <CardDescription>{config.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-4">
                  <EmptyState title="Ainda não há registros aqui" description="Não foi possível encontrar dados no momento." />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}
