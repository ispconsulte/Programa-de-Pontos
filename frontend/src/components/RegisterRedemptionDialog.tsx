import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, Gift, Search, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type CustomerOption = {
  id: string
  name: string
  availablePoints: number
}

type GiftOption = {
  id: string
  name: string
  requiredPoints: number
}

interface RegisterRedemptionDialogProps {
  trigger: ReactNode
  defaultCustomerId?: string
  customers?: CustomerOption[]
  gifts?: GiftOption[]
}

export default function RegisterRedemptionDialog({
  trigger,
  defaultCustomerId,
  customers = [],
  gifts = [],
}: RegisterRedemptionDialogProps) {
  const [open, setOpen] = useState(false)
  const [customerQuery, setCustomerQuery] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState(defaultCustomerId ?? '')
  const [selectedGiftId, setSelectedGiftId] = useState('')
  const [responsible, setResponsible] = useState('')
  const [notes, setNotes] = useState('')

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  )

  const selectedGift = useMemo(
    () => gifts.find((gift) => gift.id === selectedGiftId) ?? null,
    [gifts, selectedGiftId]
  )

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase()
    if (!query) return customers
    return customers.filter((customer) => {
      return (
        customer.name.toLowerCase().includes(query) ||
        customer.id.toLowerCase().includes(query)
      )
    })
  }, [customerQuery, customers])

  const availablePoints = selectedCustomer?.availablePoints ?? 0
  const requiredPoints = selectedGift?.requiredPoints ?? 0
  const isBlocked = !!selectedGift && !!selectedCustomer && availablePoints < requiredPoints
  const canConfirm =
    customers.length > 0 &&
    gifts.length > 0 &&
    !!selectedCustomer &&
    !!selectedGift &&
    !!responsible.trim() &&
    !isBlocked

  useEffect(() => {
    if (!open) return

    setSelectedCustomerId(defaultCustomerId ?? '')
    setSelectedGiftId('')
    setResponsible('')
    setNotes('')
    setCustomerQuery('')
  }, [defaultCustomerId, open])

  const handleConfirm = () => {
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl border-[hsl(var(--border))] bg-[linear-gradient(180deg,rgba(16,185,129,0.06),rgba(255,255,255,0)_22%),hsl(var(--background))] p-0">
        <DialogHeader className="px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <Gift className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <DialogTitle>Registrar resgate</DialogTitle>
              <DialogDescription className="mt-1.5 max-w-xl">
                Registre um novo resgate apenas quando houver dados reais de cliente e de brinde disponiveis.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="customer-search" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Selecionar cliente
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="customer-search"
                    value={customerQuery}
                    onChange={(event) => {
                      setCustomerQuery(event.target.value)
                      if (selectedCustomerId) {
                        setSelectedCustomerId('')
                      }
                    }}
                    placeholder="Buscar por nome do cliente ou IXC ID"
                    className="pl-9"
                  />
                </div>

                <div className="scrollable-content max-h-44 space-y-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-2">
                  {filteredCustomers.map((customer) => {
                    const isSelected = customer.id === selectedCustomerId
                    return (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId(customer.id)
                          setCustomerQuery(customer.name)
                        }}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors',
                          isSelected ? 'bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/20' : 'hover:bg-[hsl(var(--muted))] text-muted-foreground'
                        )}
                      >
                        <div>
                          <p className="text-sm font-medium">{customer.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">IXC #{customer.id}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Saldo</p>
                          <p className="mt-1 text-sm font-semibold text-emerald-300">
                            {customer.availablePoints.toLocaleString('pt-BR')} pts
                          </p>
                        </div>
                      </button>
                    )
                  })}

                  {filteredCustomers.length === 0 && (
                    <div className="rounded-lg border border-dashed border-[hsl(var(--border))] px-3 py-5 text-center text-sm text-muted-foreground">
                      {customers.length === 0 ? 'Ainda nao ha registros aqui.' : 'Nenhum resultado encontrado. Tente novamente mais tarde.'}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Selecionar brinde
                </Label>
                <Select value={selectedGiftId} onValueChange={setSelectedGiftId}>
                  <SelectTrigger>
                    <SelectValue placeholder={gifts.length === 0 ? 'Nenhum dado encontrado' : 'Escolha o brinde e a pontuacao necessaria'} />
                  </SelectTrigger>
                  <SelectContent>
                    {gifts.map((gift) => (
                      <SelectItem key={gift.id} value={gift.id}>
                        {gift.name} · {gift.requiredPoints} pts
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="responsible" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Responsavel pela entrega
                  </Label>
                  <Input
                    id="responsible"
                    value={responsible}
                    onChange={(event) => setResponsible(event.target.value)}
                    placeholder="Nome do responsavel pela entrega"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Pontos disponiveis do cliente
                  </Label>
                  <div className="flex h-10 items-center rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3.5 text-sm font-semibold text-white">
                    {selectedCustomer ? `${availablePoints.toLocaleString('pt-BR')} pts` : 'Nenhum dado encontrado'}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Observacoes
                </Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Observacoes operacionais, contexto da entrega ou anotacoes do IXC"
                  className="min-h-[110px] w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none transition-all duration-200 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-200">Resumo operacional</p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Cliente</span>
                    <span className="text-sm font-medium text-white">{selectedCustomer?.name ?? 'Nenhum dado encontrado'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Brinde</span>
                    <span className="text-sm font-medium text-white">{selectedGift?.name ?? 'Nenhum dado encontrado'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Pontos necessarios</span>
                    <span className="text-sm font-medium text-white">{requiredPoints ? `${requiredPoints} pts` : 'Nenhum dado encontrado'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Pontos disponiveis</span>
                    <span className="text-sm font-medium text-emerald-300">
                      {selectedCustomer ? `${availablePoints.toLocaleString('pt-BR')} pts` : 'Nenhum dado encontrado'}
                    </span>
                  </div>
                </div>
              </div>

              {selectedCustomer && selectedGift && isBlocked && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 text-rose-300">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-rose-200">Bloqueado: saldo insuficiente</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        O cliente possui {availablePoints.toLocaleString('pt-BR')} pts, mas este brinde exige {requiredPoints.toLocaleString('pt-BR')} pts.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--surface-3))] text-muted-foreground ring-1 ring-[hsl(var(--border))]">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Fluxo administrativo confiavel</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      O resgate so pode ser confirmado quando cliente, brinde e responsavel estiverem definidos e houver dados disponiveis.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            Confirmar resgate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
