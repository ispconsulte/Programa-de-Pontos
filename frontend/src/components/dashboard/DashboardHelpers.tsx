import { type LucideIcon } from 'lucide-react'

export function formatPoints(value: number): string {
  return value.toLocaleString('pt-BR')
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = toLocalDate(value)
  if (!date) return '—'
  return date.toLocaleDateString('pt-BR')
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function toLocalDate(value?: string | null): Date | null {
  if (!value) return null
  const fromNative = new Date(value)
  if (!Number.isNaN(fromNative.getTime())) {
    return new Date(fromNative.getFullYear(), fromNative.getMonth(), fromNative.getDate())
  }
  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!dateOnly) return null
  return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
}

export function persistedDateRange() {
  const now = new Date()
  return { from: '2020-01-01', to: now.toISOString().slice(0, 10), label: 'Base completa' }
}

export const avatarColors = [
  'bg-emerald-500/15 text-emerald-500', 'bg-sky-500/15 text-sky-500',
  'bg-amber-500/15 text-amber-500', 'bg-rose-500/15 text-rose-500',
  'bg-violet-500/15 text-violet-500', 'bg-teal-500/15 text-teal-500',
]

export function avatarColor(name: string): string {
  return avatarColors[(name || '#').charCodeAt(0) % avatarColors.length]
}

/* ── Sub-components ── */

export function KpiCard({ label, value, helper, icon: Icon, gradient, iconClass }: {
  label: string; value: string; helper: string; icon: LucideIcon; gradient: string; iconClass: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-border bg-gradient-to-br ${gradient} p-5`}>
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconClass}`}><Icon className="h-4 w-4" /></div>
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  )
}

export function RankBadge({ position }: { position: number }) {
  if (position === 1) return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">🥇</span>
  if (position === 2) return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-400/20 text-xs font-bold text-slate-300">🥈</span>
  if (position === 3) return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-700/20 text-xs font-bold text-amber-600">🥉</span>
  return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{position}</span>
}

export function PointCard({ label, value, icon: Icon, variant }: { label: string; value: number; icon: LucideIcon; variant: 'emerald' | 'amber' | 'primary' }) {
  const styles = {
    emerald: 'border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-emerald-500/[0.02]',
    amber: 'border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] to-amber-500/[0.02]',
    primary: 'border-primary/25 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02]',
  }
  const iconStyles = {
    emerald: 'bg-emerald-500/15 text-emerald-500',
    amber: 'bg-amber-500/15 text-amber-500',
    primary: 'bg-primary/15 text-primary',
  }
  return (
    <div className={`rounded-xl border p-4 ${styles[variant]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">{value.toLocaleString('pt-BR')}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconStyles[variant]}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  )
}

export function InfoField({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 px-3 py-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-3.5 w-3.5 text-primary/70" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/60">{label}</p>
        <div className="mt-0.5 truncate text-sm font-medium text-foreground">{children || '-'}</div>
      </div>
    </div>
  )
}

export function RedemptionStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  const map: Record<string, { label: string; cls: string }> = {
    pendente: { label: 'Pendente', cls: 'bg-amber-500/10 text-amber-400' },
    solicitado: { label: 'Solicitado', cls: 'bg-sky-500/10 text-sky-400' },
    entregue: { label: 'Entregue', cls: 'bg-emerald-500/10 text-emerald-400' },
    cancelado: { label: 'Cancelado', cls: 'bg-rose-500/10 text-rose-400' },
  }
  const found = map[s] || { label: status, cls: 'bg-muted text-muted-foreground' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${found.cls}`}>
      {found.label}
    </span>
  )
}
