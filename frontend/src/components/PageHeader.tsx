import { type LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  icon?: LucideIcon
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export default function PageHeader({ icon: Icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header mb-6">
      <div className="page-header__lead">
        {Icon && (
          <div className="page-header__icon bg-primary/[0.08] ring-1 ring-primary/[0.12]">
            <Icon className="icon-uniform text-primary" />
          </div>
        )}
        <div className="page-header__content">
          <h1 className="page-header__title font-heading font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="page-header__subtitle text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  )
}
