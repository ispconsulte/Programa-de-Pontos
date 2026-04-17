import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Gift, Search } from 'lucide-react'
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
import type { CampaignClientRow } from '@/lib/supabase-queries'

interface RegisterRedemptionDialogProps {
  trigger: ReactNode
  preselectedClient?: CampaignClientRow | null
  onRedemptionComplete?: () => void
}

interface GiftOption {
  id: string
  name: string
  requiredPoints: number
}

const MOCK_GIFTS: GiftOption[] = [
  { id: 'gift-1', name: 'Caneca térmica', requiredPoints: 30 },
  { id: 'gift-2', name: 'Squeeze premium', requiredPoints: 20 },
  { id: 'gift-3', name: 'Kit boas-vindas', requiredPoints: 50 },
]

const LEAVE_WARNING_MESSAGE = 'Você iniciou um resgate e ainda não concluiu o registro. Tem certeza que deseja sair sem salvar?'

interface RedemptionFormState {
  isActiveCustomer: boolean
  clientQuery: string
  leadName: string
  leadPhone: string
  selectedGiftId: string
  quantity: string
  responsible: string
  notes: string
}

export default function RegisterRedemptionDialog({
  trigger,
  preselectedClient,
}: RegisterRedemptionDialogProps) {
  const [open, setOpen] = useState(false)
  const [isActiveCustomer, setIsActiveCustomer] = useState(true)
  const [clientQuery, setClientQuery] = useState('')
  const [leadName, setLeadName] = useState('')
  const [leadPhone, setLeadPhone] = useState('')
  const [selectedGiftId, setSelectedGiftId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [responsible, setResponsible] = useState('')
  const [notes, setNotes] = useState('')

  const initialFormState = useMemo<RedemptionFormState>(() => ({
    isActiveCustomer: true,
    clientQuery: preselectedClient?.nome_cliente ?? '',
    leadName: '',
    leadPhone: '',
    selectedGiftId: '',
    quantity: '1',
    responsible: '',
    notes: '',
  }), [preselectedClient])

  const selectedGift = useMemo(
    () => MOCK_GIFTS.find((gift) => gift.id === selectedGiftId) ?? null,
    [selectedGiftId],
  )
  const currentFormState = useMemo<RedemptionFormState>(() => ({
    isActiveCustomer,
    clientQuery,
    leadName,
    leadPhone,
    selectedGiftId,
    quantity,
    responsible,
    notes,
  }), [
    clientQuery,
    isActiveCustomer,
    leadName,
    leadPhone,
    notes,
    quantity,
    responsible,
    selectedGiftId,
  ])
  const isDirty = JSON.stringify(currentFormState) !== JSON.stringify(initialFormState)

  useEffect(() => {
    if (!open) return

    setIsActiveCustomer(initialFormState.isActiveCustomer)
    setClientQuery(initialFormState.clientQuery)
    setLeadName(initialFormState.leadName)
    setLeadPhone(initialFormState.leadPhone)
    setSelectedGiftId(initialFormState.selectedGiftId)
    setQuantity(initialFormState.quantity)
    setResponsible(initialFormState.responsible)
    setNotes(initialFormState.notes)
  }, [initialFormState, open])

  useEffect(() => {
    if (!open || !isDirty) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = LEAVE_WARNING_MESSAGE
      return LEAVE_WARNING_MESSAGE
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isDirty, open])

  const normalizedQuantity = Math.max(1, Number.parseInt(quantity || '1', 10) || 1)

  const requestClose = () => {
    if (isDirty && !window.confirm(LEAVE_WARNING_MESSAGE)) {
      return
    }

    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setOpen(true)
          return
        }

        requestClose()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg gap-0 border-border bg-card p-0">
        <DialogHeader className="px-6 pb-4 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <Gift className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <DialogTitle className="text-base">Registrar resgate</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                Defina o destinatário, o brinde e os dados da entrega.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <input
              id="cliente-ativo"
              type="checkbox"
              checked={isActiveCustomer}
              onChange={(event) => setIsActiveCustomer(event.target.checked)}
              className="h-4 w-4 rounded border-input bg-background accent-emerald-500"
            />
            <Label htmlFor="cliente-ativo" className="text-sm font-medium text-foreground">
              Cliente ativo
            </Label>
          </div>

          {isActiveCustomer ? (
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={clientQuery}
                  onChange={(event) => setClientQuery(event.target.value)}
                  placeholder="Nome ou CPF do cliente"
                  className="pl-9"
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Nome</Label>
                <Input
                  value={leadName}
                  onChange={(event) => setLeadName(event.target.value)}
                  placeholder="Nome"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Telefone</Label>
                <Input
                  value={leadPhone}
                  onChange={(event) => setLeadPhone(event.target.value)}
                  placeholder="Telefone"
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Brinde</Label>
              <Select value={selectedGiftId} onValueChange={setSelectedGiftId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o brinde" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_GIFTS.map((gift) => (
                    <SelectItem key={gift.id} value={gift.id}>
                      {gift.name} - {gift.requiredPoints} pts
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Quantidade</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(event) => setQuantity(String(Math.max(1, Number.parseInt(event.target.value || '1', 10) || 1)))}
              />
            </div>
          </div>

          {selectedGift && (
            <p className="text-xs text-muted-foreground">
              Total desta seleção: <span className="font-semibold text-foreground">{selectedGift.requiredPoints * normalizedQuantity} pts</span>
            </p>
          )}

          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Responsável pela entrega</Label>
            <Input
              value={responsible}
              onChange={(event) => setResponsible(event.target.value)}
              placeholder="Responsável pela entrega"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Observações (opcional)</Label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Observações (opcional)"
              className="min-h-[88px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" onClick={requestClose}>
            Cancelar
          </Button>
          <Button className="bg-emerald-600 text-white hover:bg-emerald-500">
            Confirmar resgate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
