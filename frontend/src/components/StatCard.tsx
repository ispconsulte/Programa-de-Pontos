import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  iconColor?: string
  iconBg?: string
  helper?: string
  className?: string
}

export default function StatCard({ label, value, icon: Icon, iconColor, iconBg, helper, className }: StatCardProps) {
  return (
    <div className={cn('stat-card rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-5', className)}>
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
        {Icon && (
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconBg || 'bg-primary/10')}>
            <Icon className={cn('h-4 w-4', iconColor || 'text-primary')} />
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
    </div>
  )
}
