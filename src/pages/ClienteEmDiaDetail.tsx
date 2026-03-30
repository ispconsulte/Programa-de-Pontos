import Layout from '@/components/Layout'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Award,
  ChevronRight,
  Clock,
  Coins,
  Gift,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Settings,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react'

/* ── Placeholder data ── */

const customer = {
  nome: 'Fernanda Lima',
  ixcId: '10482',
  status: 'ativo' as const,
  pontosDisponiveis: 780,
  pontosAcumulados: 1240,
  pontosResgatados: 460,
}

const timeline = [
  { id: '1', date: '29/03/2026', type: 'credit' as const, label: 'Pagamento antecipado', pts: 5, icon: TrendingUp },
  { id: '2', date: '25/03/2026', type: 'credit' as const, label: 'Ativação SVA', pts: 3, icon: Zap },
  { id: '3', date: '20/03/2026', type: 'debit' as const, label: 'Resgate — Kit Limpeza', pts: -10, icon: Gift },
  { id: '4', date: '15/03/2026', type: 'credit' as const, label: 'Pagamento antecipado', pts: 5, icon: TrendingUp },
  { id: '5', date: '01/03/2026', type: 'credit' as const, label: 'Bônus mensal', pts: 10, icon: Award },
  { id: '6', date: '25/02/2026', type: 'credit' as const, label: 'Pagamento antecipado', pts: 5, icon: TrendingUp },
]

const redemptions = [
  { id: '1', item: 'Kit Limpeza Premium', pts: 10, date: '20/03/2026', status: 'entregue' as const },
  { id: '2', item: 'Desconto 15% na fatura', pts: 25, date: '10/02/2026', status: 'aplicado' as const },
  { id: '3', item: 'Camiseta Exclusiva', pts: 50, date: '05/01/2026', status: 'enviado' as const },
]

const statusStyles: Record<string, string> = {
  ativo: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  pendente: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  inativo: 'bg-red-500/10 text-red-400 ring-red-500/20',
}

const statusLabels: Record<string, string> = {
  ativo: 'Ativo',
  pendente: 'Pendente',
  inativo: 'Inativo',
}

const deliveryStyles: Record<string, string> = {
  entregue: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  aplicado: 'bg-sky-500/10 text-sky-400 ring-sky-500/20',
  enviado: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  pendente: 'bg-muted text-muted-foreground ring-border',
}

const deliveryLabels: Record<string, string> = {
  entregue: 'Entregue',
  aplicado: 'Aplicado',
  enviado: 'Enviado',
  pendente: 'Pendente',
}

/* ── Page ── */

export default function ClienteEmDiaDetailPage() {
  const { ixc_cliente_id } = useParams()

  return (
    <Layout>
      <div className="space-y-6">
        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link
            to="/cliente-em-dia"
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Cliente em Dia
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{customer.nome}</span>
        </div>

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <Star className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  {customer.nome}
                </h1>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${statusStyles[customer.status]}`}
                >
                  {statusLabels[customer.status]}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                IXC #{ixc_cliente_id ?? customer.ixcId}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Pontos disponíveis
            </p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-emerald-400">
              {customer.pontosDisponiveis.toLocaleString('pt-BR')}
            </p>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-500">
            <Plus className="h-3.5 w-3.5" />
            Adicionar pontos
          </button>
          <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/60 bg-card px-4 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Gift className="h-3.5 w-3.5" />
            Registrar resgate
          </button>
          <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/60 bg-card px-4 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Settings className="h-3.5 w-3.5" />
            Alterar status
          </button>
        </div>

        {/* ── Financial summary ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: 'Pontos acumulados', value: customer.pontosAcumulados, icon: Coins, color: 'emerald' },
            { label: 'Pontos resgatados', value: customer.pontosResgatados, icon: Minus, color: 'amber' },
            { label: 'Pontos disponíveis', value: customer.pontosDisponiveis, icon: Award, color: 'emerald' },
          ].map((card) => {
            const Icon = card.icon
            const isAmber = card.color === 'amber'
            return (
              <div
                key={card.label}
                className="rounded-xl border border-border/50 bg-card p-5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${
                      isAmber
                        ? 'bg-amber-500/10 ring-amber-500/20'
                        : 'bg-emerald-500/10 ring-emerald-500/20'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isAmber ? 'text-amber-400' : 'text-emerald-400'}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      {card.value.toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Two-column: Timeline + Redemptions ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Timeline */}
          <div className="rounded-xl border border-border/50 bg-card">
            <div className="border-b border-border/40 px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Histórico de eventos</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Movimentações recentes de pontuação
              </p>
            </div>
            <div className="divide-y divide-border/20">
              {timeline.map((evt) => {
                const Icon = evt.icon
                const isCredit = evt.type === 'credit'
                return (
                  <div key={evt.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ring-1 ${
                        isCredit
                          ? 'bg-emerald-500/10 ring-emerald-500/20'
                          : 'bg-red-500/10 ring-red-500/20'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isCredit ? 'text-emerald-400' : 'text-red-400'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{evt.label}</p>
                      <p className="text-xs text-muted-foreground">{evt.date}</p>
                    </div>
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        isCredit ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {isCredit ? '+' : ''}{evt.pts} pts
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Redemptions */}
          <div className="rounded-xl border border-border/50 bg-card">
            <div className="border-b border-border/40 px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Histórico de resgates</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Recompensas resgatadas pelo cliente
              </p>
            </div>
            <div className="divide-y divide-border/20">
              {redemptions.map((r) => (
                <div key={r.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{r.item}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.date} · {r.pts} pts
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${deliveryStyles[r.status]}`}
                  >
                    {deliveryLabels[r.status]}
                  </span>
                </div>
              ))}

              {redemptions.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Nenhum resgate registrado.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
