import Layout from '@/components/Layout'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Coins,
  Clock,
  TrendingUp,
  MoreHorizontal,
  Search,
  Filter,
  Download,
  Star,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

/* ── Placeholder data ── */

const kpis = [
  {
    label: 'Clientes participantes',
    value: '1.248',
    change: '+12%',
    positive: true,
    icon: Users,
  },
  {
    label: 'Pontos distribuídos (mês)',
    value: '34.520',
    change: '+8,4%',
    positive: true,
    icon: Coins,
  },
  {
    label: 'Resgates pendentes',
    value: '87',
    change: '-3%',
    positive: false,
    icon: Clock,
  },
  {
    label: 'Clientes em dia (mês)',
    value: '72%',
    change: '+5pp',
    positive: true,
    icon: TrendingUp,
  },
]

const distributionData = [
  { bucket: '0–9', count: 312, fill: 'hsl(160 50% 25%)' },
  { bucket: '10–24', count: 458, fill: 'hsl(160 55% 35%)' },
  { bucket: '25–49', count: 326, fill: 'hsl(160 60% 42%)' },
  { bucket: '50+', count: 152, fill: 'hsl(160 65% 50%)' },
]

interface ClientRow {
  id: string
  nome: string
  status: 'ativo' | 'inativo' | 'pendente'
  pontosDisponiveis: number
  ultimoPagamento: string
  pontosMes: number
}

const clients: ClientRow[] = [
  { id: '1', nome: 'Maria Silva', status: 'ativo', pontosDisponiveis: 420, ultimoPagamento: '28/03/2026', pontosMes: 85 },
  { id: '2', nome: 'João Oliveira', status: 'ativo', pontosDisponiveis: 310, ultimoPagamento: '25/03/2026', pontosMes: 60 },
  { id: '3', nome: 'Ana Costa', status: 'pendente', pontosDisponiveis: 150, ultimoPagamento: '20/03/2026', pontosMes: 30 },
  { id: '4', nome: 'Carlos Santos', status: 'inativo', pontosDisponiveis: 0, ultimoPagamento: '10/02/2026', pontosMes: 0 },
  { id: '5', nome: 'Fernanda Lima', status: 'ativo', pontosDisponiveis: 780, ultimoPagamento: '29/03/2026', pontosMes: 120 },
  { id: '6', nome: 'Ricardo Mendes', status: 'ativo', pontosDisponiveis: 540, ultimoPagamento: '27/03/2026', pontosMes: 95 },
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

/* ── Custom chart tooltip ── */

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-foreground">{label} pontos</p>
      <p className="text-muted-foreground">{payload[0].value} clientes</p>
    </div>
  )
}

/* ── Page ── */

export default function ClienteEmDiaPage() {
  return (
    <Layout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <Star className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Cliente em Dia
              </h1>
              <p className="text-sm text-muted-foreground">
                Campanhas de fidelização e pontuação por pagamento antecipado.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Download className="h-3.5 w-3.5" />
              Exportar
            </button>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-500">
              + Nova campanha
            </button>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon
            return (
              <div
                key={kpi.label}
                className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-5 transition-colors hover:border-emerald-500/20"
              >
                {/* accent glow */}
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-emerald-500/[0.04] transition-all group-hover:bg-emerald-500/[0.08]" />

                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                    <Icon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      kpi.positive ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {kpi.change}
                  </span>
                </div>

                <p className="mt-4 text-2xl font-bold tracking-tight text-foreground">
                  {kpi.value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            )
          })}
        </div>

        {/* ── Chart ── */}
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Distribuição de pontuação
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Número de clientes por faixa de pontos acumulados
              </p>
            </div>
          </div>

          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distributionData}
                margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                barCategoryGap="24%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(225 15% 13%)"
                  vertical={false}
                />
                <XAxis
                  dataKey="bucket"
                  tick={{ fill: 'hsl(220 10% 55%)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'hsl(220 10% 55%)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(225 20% 10% / 0.5)' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {distributionData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="rounded-xl border border-border/50 bg-card">
          {/* toolbar */}
          <div className="flex flex-col gap-3 border-b border-border/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-foreground">Clientes</h2>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar cliente…"
                  className="h-9 w-56 rounded-lg border border-border/60 bg-background pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                />
              </div>
              <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <Filter className="h-3.5 w-3.5" />
                Filtrar
              </button>
            </div>
          </div>

          {/* table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Nome</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Pontos disponíveis</th>
                  <th className="px-5 py-3 font-medium">Último pagamento</th>
                  <th className="px-5 py-3 font-medium text-right">Pontos (mês)</th>
                  <th className="px-5 py-3 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/cliente-em-dia/${c.id}`)}
                    className="cursor-pointer transition-colors hover:bg-muted/30"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-foreground">
                      {c.nome}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${statusStyles[c.status]}`}
                      >
                        {statusLabels[c.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right tabular-nums text-foreground">
                      {c.pontosDisponiveis.toLocaleString('pt-BR')}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">
                      {c.ultimoPagamento}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right tabular-nums text-foreground">
                      +{c.pontosMes}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* footer */}
          <div className="flex items-center justify-between border-t border-border/30 px-5 py-3">
            <p className="text-xs text-muted-foreground">
              Mostrando {clients.length} de {clients.length} clientes
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
