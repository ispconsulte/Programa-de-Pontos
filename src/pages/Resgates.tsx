import Layout from '@/components/Layout'
import { useState } from 'react'
import {
  ArrowLeft,
  ChevronRight,
  Filter,
  Gift,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  CalendarCheck,
  Search,
} from 'lucide-react'
import { Link } from 'react-router-dom'

/* ── Status config ── */

type RedemptionStatus = 'eligible' | 'requested' | 'preparing' | 'delivered' | 'completed'

const statusConfig: Record<RedemptionStatus, { label: string; icon: React.ElementType; color: string; bg: string; ring: string }> = {
  eligible:  { label: 'Elegível para resgate', icon: Gift,          color: 'text-sky-400',     bg: 'bg-sky-500/10',     ring: 'ring-sky-500/20' },
  requested: { label: 'Resgate solicitado',    icon: Clock,         color: 'text-amber-400',   bg: 'bg-amber-500/10',   ring: 'ring-amber-500/20' },
  preparing: { label: 'Em preparação',         icon: Package,       color: 'text-violet-400',  bg: 'bg-violet-500/10',  ring: 'ring-violet-500/20' },
  delivered: { label: 'Entregue',              icon: Truck,         color: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
  completed: { label: 'Ciclo encerrado',       icon: CalendarCheck, color: 'text-muted-foreground', bg: 'bg-muted',     ring: 'ring-border' },
}

const allStatuses: RedemptionStatus[] = ['eligible', 'requested', 'preparing', 'delivered', 'completed']

/* ── Placeholder data ── */

interface Redemption {
  id: string
  cliente: string
  brinde: string
  pontos: number
  data: string
  status: RedemptionStatus
}

const redemptions: Redemption[] = [
  { id: '1', cliente: 'Fernanda Lima',    brinde: 'Kit Limpeza Premium',     pontos: 10,  data: '29/03/2026', status: 'eligible' },
  { id: '2', cliente: 'João Oliveira',    brinde: 'Camiseta Exclusiva',      pontos: 50,  data: '28/03/2026', status: 'eligible' },
  { id: '3', cliente: 'Maria Silva',      brinde: 'Desconto 15% na fatura',  pontos: 25,  data: '27/03/2026', status: 'requested' },
  { id: '4', cliente: 'Carlos Santos',    brinde: 'Caneca Personalizada',    pontos: 15,  data: '26/03/2026', status: 'requested' },
  { id: '5', cliente: 'Ana Costa',        brinde: 'Kit Limpeza Premium',     pontos: 10,  data: '25/03/2026', status: 'preparing' },
  { id: '6', cliente: 'Ricardo Mendes',   brinde: 'Desconto 15% na fatura',  pontos: 25,  data: '22/03/2026', status: 'delivered' },
  { id: '7', cliente: 'Paula Ferreira',   brinde: 'Camiseta Exclusiva',      pontos: 50,  data: '18/03/2026', status: 'delivered' },
  { id: '8', cliente: 'Lucas Almeida',    brinde: 'Caneca Personalizada',    pontos: 15,  data: '10/03/2026', status: 'completed' },
  { id: '9', cliente: 'Beatriz Souza',    brinde: 'Kit Limpeza Premium',     pontos: 10,  data: '05/03/2026', status: 'completed' },
]

const gifts = [...new Set(redemptions.map(r => r.brinde))]

/* ── Page ── */

export default function ResgatesPage() {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<RedemptionStatus | 'all'>('all')
  const [filterGift, setFilterGift] = useState<string>('all')

  const filtered = redemptions.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (filterGift !== 'all' && r.brinde !== filterGift) return false
    if (search && !r.cliente.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const grouped = allStatuses.map(s => ({
    status: s,
    items: filtered.filter(r => r.status === s),
  })).filter(g => g.items.length > 0)

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/cliente-em-dia" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            Cliente em Dia
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Resgates</span>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Pipeline de Resgates</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Gerencie o fluxo de resgates de brindes e recompensas.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums font-medium text-foreground">{filtered.length}</span> resgates
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar cliente…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 w-52 rounded-lg border border-border/60 bg-background pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            />
          </div>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as RedemptionStatus | 'all')}
            className="h-9 rounded-lg border border-border/60 bg-card px-3 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
          >
            <option value="all">Todos os status</option>
            {allStatuses.map(s => (
              <option key={s} value={s}>{statusConfig[s].label}</option>
            ))}
          </select>

          <select
            value={filterGift}
            onChange={e => setFilterGift(e.target.value)}
            className="h-9 rounded-lg border border-border/60 bg-card px-3 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
          >
            <option value="all">Todos os brindes</option>
            {gifts.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* Grouped pipeline */}
        <div className="space-y-4">
          {grouped.map(group => {
            const cfg = statusConfig[group.status]
            const Icon = cfg.icon
            return (
              <div key={group.status} className="rounded-xl border border-border/50 bg-card">
                {/* Group header */}
                <div className="flex items-center gap-3 border-b border-border/40 px-5 py-3.5">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cfg.bg} ring-1 ${cfg.ring}`}>
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{cfg.label}</p>
                  </div>
                  <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-bold ${cfg.bg} ${cfg.color} ring-1 ${cfg.ring}`}>
                    {group.items.length}
                  </span>
                </div>

                {/* Items */}
                <div className="divide-y divide-border/20">
                  {group.items.map(item => (
                    <div key={item.id} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/20">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{item.cliente}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.brinde}</p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="text-xs text-muted-foreground">{item.data}</p>
                      </div>
                      <span className="whitespace-nowrap text-sm font-bold tabular-nums text-foreground">
                        {item.pontos} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {grouped.length === 0 && (
            <div className="rounded-xl border border-border/50 bg-card px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">Nenhum resgate encontrado com os filtros selecionados.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
