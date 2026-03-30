import { type LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  icon?: LucideIcon
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export default function PageHeader({ icon: Icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3.5">
        {Icon && (
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/[0.08] ring-1 ring-primary/[0.12]">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white font-heading">{title}</h1>
          {subtitle && <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
