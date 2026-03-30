import { type LucideIcon, ShieldAlert, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type AlertVariant = 'error' | 'success' | 'warning' | 'info'

const variantConfig: Record<AlertVariant, { className: string; icon: LucideIcon }> = {
  error: { className: 'alert-surface alert-error', icon: ShieldAlert },
  success: { className: 'alert-surface alert-success', icon: CheckCircle2 },
  warning: { className: 'alert-surface alert-warning', icon: AlertTriangle },
  info: { className: 'alert-surface alert-info', icon: Info },
}

interface AlertBannerProps {
  variant?: AlertVariant
  message: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export default function AlertBanner({ variant = 'error', message, actionLabel, onAction, className }: AlertBannerProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <div className={cn(config.className, 'flex items-start gap-3', className)}>
      <Icon className="alert-icon mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed">{message}</p>
        {actionLabel && onAction && (
          <Button variant="outline" size="sm" className="mt-2.5" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
