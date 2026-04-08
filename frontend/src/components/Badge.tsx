import { Badge as ShadcnBadge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type BadgeVariant = 'green' | 'yellow' | 'blue' | 'red' | 'gray'

interface BadgeProps {
  variant: BadgeVariant
  label: string
}

const variantClasses: Record<BadgeVariant, string> = {
  green: 'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-400',
  yellow: 'border-amber-500/20 bg-amber-500/[0.08] text-amber-400',
  blue: 'border-sky-500/20 bg-sky-500/[0.08] text-sky-400',
  red: 'border-rose-500/20 bg-rose-500/[0.08] text-rose-400',
  gray: 'border-[hsl(var(--border))] bg-[hsl(var(--surface-3))] text-muted-foreground',
}

export default function Badge({ variant, label, className }: BadgeProps & { className?: string }) {
  return (
    <ShadcnBadge
      variant="outline"
      className={cn('rounded-md px-2.5 py-0.5 text-[11px] font-medium', variantClasses[variant], className)}
    >
      {label}
    </ShadcnBadge>
  )
}

export function categoryBadge(category: string) {
  const badgeClass = 'min-w-[6.5rem] justify-center text-center'
  switch (category?.toLowerCase()) {
    case 'antecipado':
    case 'pagamento antecipado':
      return <Badge variant="green" label="antecipado" className={badgeClass} />
    case 'vencimento':
    case 'pagamento no vencimento':
      return <Badge variant="blue" label="no vencimento" className={badgeClass} />
    case 'atraso':
    case 'pagamento após o vencimento':
    case 'pagamento apos o vencimento':
      return <Badge variant="red" label="atraso" className={badgeClass} />
    case 'received':
    case 'recebido':
      return <Badge variant="green" label="Recebido" className={badgeClass} />
    case 'renegotiated':
    case 'renegociado':
      return <Badge variant="yellow" label="Renegociado" className={badgeClass} />
    case 'open':
    case 'em aberto':
    case 'aberto':
      return <Badge variant="blue" label="Em aberto" className={badgeClass} />
    case 'cancelled':
    case 'cancelado':
      return <Badge variant="red" label="Cancelado" className={badgeClass} />
    default:
      return <Badge variant="gray" label={category || 'Não encontrado'} className={badgeClass} />
  }
}

export function statusBadge(status: string | number | boolean) {
  const s = String(status).toLowerCase()
  if (s === 'r' || s === 'recebido') {
    return <Badge variant="green" label="Recebido" />
  }
  if (s === 'renegociado') {
    return <Badge variant="yellow" label="Renegociado" />
  }
  if (s === 'a' || s === 'open' || s === 'aberto' || s === 'em aberto') {
    return <Badge variant="blue" label="Em aberto" />
  }
  if (s === 'c' || s === 'cancelado' || s === 'cancelled') {
    return <Badge variant="red" label="Cancelado" />
  }
  if (s === 'ativo' || s === 'active' || s === 'true' || s === '1' || s === 's' || s === 'sim') {
    return <Badge variant="green" label="Ativo" />
  }
  if (s === 'inativo' || s === 'inactive' || s === 'false' || s === '0' || s === 'i' || s === 'n' || s === 'nao') {
    return <Badge variant="red" label="Inativo" />
  }
  return <Badge variant="gray" label={String(status) || 'Não encontrado'} />
}
