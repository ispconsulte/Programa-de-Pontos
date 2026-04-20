import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Gift, Search } from 'lucide-react'
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
import { autocompleteCampaignClients, getCurrentTenantId, type CampaignClientRow } from '@/lib/supabase-queries'
import {
  fetchRewardCatalogItems,
  registerRewardRedemption,
  type RewardCatalogRow,
  type RewardRedemptionResult,
} from '@/lib/loyalty-admin'
import Spinner from '@/components/Spinner'

interface RegisterRedemptionDialogProps {
  trigger: ReactNode
  preselectedClient?: CampaignClientRow | null
  onRedemptionComplete?: () => void
}

interface GiftOption {
  id: string
  name: string
  requiredPoints: number
  stock: number | null
}

interface RedemptionFormState {
  isActiveCustomer: boolean
  customerQuery: string
  selectedClientId: string
  leadName: string
  leadPhone: string
  selectedGiftId: string
  quantity: string
  responsible: string
  notes: string
}

const LEAVE_WARNING_MESSAGE = 'Você iniciou um resgate e ainda não concluiu o registro. Tem certeza que deseja sair sem salvar?'

function formatPhonePtBr(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export default function RegisterRedemptionDialog({
  trigger,
  preselectedClient,
  onRedemptionComplete,
}: RegisterRedemptionDialogProps) {
  const [open, setOpen] = useState(false)
  const [isActiveCustomer, setIsActiveCustomer] = useState(true)
  const [customerQuery, setCustomerQuery] = useState('')
  const [suggestions, setSuggestions] = useState<CampaignClientRow[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<CampaignClientRow | null>(null)
  const [gifts, setGifts] = useState<GiftOption[]>([])
  const [selectedGiftId, setSelectedGiftId] = useState('')
  const [giftsLoading, setGiftsLoading] = useState(false)
  const [leadName, setLeadName] = useState('')
  const [leadPhone, setLeadPhone] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [responsible, setResponsible] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState<RewardRedemptionResult | null>(null)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedGift = useMemo(
    () => gifts.find((gift) => gift.id === selectedGiftId) ?? null,
    [gifts, selectedGiftId],
  )
  const normalizedQuantity = Math.max(1, Number.parseInt(quantity || '1', 10) || 1)
  const availablePoints = selectedClient?.pontos_disponiveis ?? 0
  const requiredPoints = (selectedGift?.requiredPoints ?? 0) * normalizedQuantity
  const isOutOfStock = !!selectedGift && selectedGift.stock != null && selectedGift.stock < normalizedQuantity
  const isBlocked = isActiveCustomer && !!selectedGift && !!selectedClient && availablePoints < requiredPoints
  const hasTarget = isActiveCustomer ? !!selectedClient : !!leadName.trim() && !!leadPhone.trim()
  const canConfirm = hasTarget && !!selectedGift && !!responsible.trim() && !isOutOfStock && !isBlocked && !submitting

  const initialFormState = useMemo<RedemptionFormState>(() => ({
    isActiveCustomer: true,
    customerQuery: preselectedClient?.nome_cliente ?? '',
    selectedClientId: preselectedClient?.id ?? '',
    leadName: '',
    leadPhone: '',
    selectedGiftId: '',
    quantity: '1',
    responsible: '',
    notes: '',
  }), [preselectedClient])

  const currentFormState = useMemo<RedemptionFormState>(() => ({
    isActiveCustomer,
    customerQuery,
    selectedClientId: selectedClient?.id ?? '',
    leadName,
    leadPhone,
    selectedGiftId,
    quantity,
    responsible,
    notes,
  }), [
    customerQuery,
    isActiveCustomer,
    leadName,
    leadPhone,
    notes,
    quantity,
    responsible,
    selectedClient?.id,
    selectedGiftId,
  ])

  const isDirty = JSON.stringify(currentFormState) !== JSON.stringify(initialFormState)

  useEffect(() => {
    if (!open) return
    let mounted = true

    const loadGifts = async () => {
      setGiftsLoading(true)
      try {
        const data = await fetchRewardCatalogItems()
        if (!mounted) return
        setGifts((data ?? [])
          .filter((gift) => gift.ativo)
          .map((gift) => ({
            id: gift.id,
            name: gift.nome,
            requiredPoints: gift.pontos_necessarios,
            stock: gift.estoque ?? null,
          })))
      } catch {
        if (!mounted) return
        setGifts([])
      } finally {
        if (mounted) setGiftsLoading(false)
      }
    }

    void loadGifts()
    return () => {
      mounted = false
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    setIsActiveCustomer(initialFormState.isActiveCustomer)
    setCustomerQuery(initialFormState.customerQuery)
    setSelectedClient(preselectedClient ?? null)
    setSuggestions([])
    setLeadName(initialFormState.leadName)
    setLeadPhone(initialFormState.leadPhone)
    setSelectedGiftId(initialFormState.selectedGiftId)
    setQuantity(initialFormState.quantity)
    setResponsible(initialFormState.responsible)
    setNotes(initialFormState.notes)
    setSubmitError('')
    setSuccess(null)
  }, [initialFormState, open, preselectedClient])

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

  const searchCustomers = useCallback(async (query: string) => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setSuggestions([])
      return
    }

    setSearchLoading(true)
    try {
      const tenantId = await getCurrentTenantId()
      if (!tenantId) return
      const results = await autocompleteCampaignClients({ tenantId, query: trimmed })
      setSuggestions(results)
    } catch {
      setSuggestions([])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setCustomerQuery(value)
    setSelectedClient(null)
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }
    searchTimerRef.current = setTimeout(() => {
      void searchCustomers(value)
    }, 250)
  }, [searchCustomers])

  const requestClose = () => {
    if (isDirty) {
      setShowLeaveConfirm(true)
      return
    }

    setOpen(false)
  }

  const confirmClose = () => {
    setShowLeaveConfirm(false)
    setOpen(false)
  }

  const handleConfirm = async () => {
    if (!canConfirm || !selectedGift) return

    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await registerRewardRedemption({
        isActiveCustomer,
        client: selectedClient,
        leadName,
        leadPhone,
        reward: {
          id: selectedGift.id,
          nome: selectedGift.name,
          descricao: null,
          pontos_necessarios: selectedGift.requiredPoints,
          ativo: true,
          estoque: selectedGift.stock,
          imagem_url: null,
        } as RewardCatalogRow,
        quantity: normalizedQuantity,
        responsible,
        notes,
      })

      setSuccess(result)
      setTimeout(() => {
        setOpen(false)
        onRedemptionComplete?.()
      }, 1200)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível registrar o resgate.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
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

          {success ? (
            <div className="flex flex-col items-center justify-center px-6 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <p className="mt-4 text-lg font-bold text-foreground">Resgate registrado!</p>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{success.redemption.brinde_nome}</span> registrado com sucesso.
            </p>
          </div>
          ) : (
            <div className="space-y-4 px-6 pb-2 pt-2">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-3">
                <input
                  id="cliente-ativo"
                  type="checkbox"
                  checked={isActiveCustomer}
                  onChange={(event) => {
                    const next = event.target.checked
                    setIsActiveCustomer(next)
                    setSubmitError('')
                    if (next) {
                      setLeadName('')
                      setLeadPhone('')
                    } else {
                      setCustomerQuery('')
                      setSelectedClient(null)
                      setSuggestions([])
                    }
                  }}
                  className="h-4 w-4 rounded border-input bg-background accent-emerald-500"
                />
                <Label htmlFor="cliente-ativo" className="text-sm font-medium text-foreground">
                  Cliente ativo
                </Label>
              </div>
            </div>

            {isActiveCustomer ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="redemption-customer" className="text-[11px] uppercase tracking-wider text-muted-foreground">Cliente</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="redemption-customer"
                      value={customerQuery}
                      onChange={(event) => handleSearchChange(event.target.value)}
                      placeholder="Nome ou CPF do cliente"
                      className="pl-9"
                      autoComplete="off"
                    />
                    {searchLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Spinner size="sm" />
                      </div>
                    )}
                    {suggestions.length > 0 && !selectedClient && (
                      <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                        {suggestions.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => {
                              setSelectedClient(client)
                              setCustomerQuery(client.nome_cliente || '')
                              setSuggestions([])
                            }}
                            className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{client.nome_cliente}</p>
                              <p className="text-xs text-muted-foreground">{client.documento || `IXC #${client.ixc_cliente_id}`}</p>
                            </div>
                            <span className="ml-2 shrink-0 text-xs font-bold text-emerald-400">
                              {(client.pontos_disponiveis ?? 0).toLocaleString('pt-BR')} pts
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {selectedClient && (
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-400">
                      {(selectedClient.nome_cliente?.[0] || '?').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{selectedClient.nome_cliente}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedClient.pontos_disponiveis?.toLocaleString('pt-BR') ?? 0} pts disponíveis
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setSelectedClient(null)
                        setCustomerQuery('')
                      }}
                    >
                      Trocar
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="redemption-lead-name" className="text-[11px] uppercase tracking-wider text-muted-foreground">Nome</Label>
                  <Input
                    id="redemption-lead-name"
                    value={leadName}
                    onChange={(event) => setLeadName(event.target.value)}
                    placeholder="Nome"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="redemption-lead-phone" className="text-[11px] uppercase tracking-wider text-muted-foreground">Telefone</Label>
                  <Input
                    id="redemption-lead-phone"
                    value={leadPhone}
                    onChange={(event) => setLeadPhone(formatPhonePtBr(event.target.value))}
                    placeholder="(11) 99999-9999"
                    inputMode="numeric"
                    autoComplete="tel"
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
              <div className="space-y-2">
                <Label htmlFor="redemption-gift" className="text-[11px] uppercase tracking-wider text-muted-foreground">Brinde</Label>
                {giftsLoading ? (
                  <div className="flex items-center justify-center py-4"><Spinner size="sm" /></div>
                ) : (
                  <Select value={selectedGiftId} onValueChange={setSelectedGiftId}>
                    <SelectTrigger id="redemption-gift">
                      <SelectValue placeholder={gifts.length === 0 ? 'Nenhum brinde disponível' : 'Selecione o brinde'} />
                    </SelectTrigger>
                    <SelectContent>
                      {gifts.map((gift) => (
                        <SelectItem key={gift.id} value={gift.id}>
                          {gift.name} - {gift.requiredPoints} pts
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="redemption-quantity" className="text-[11px] uppercase tracking-wider text-muted-foreground">Quantidade</Label>
                <Input
                  id="redemption-quantity"
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
                Total desta seleção: <span className="font-semibold text-foreground">{requiredPoints} pts</span>
                {selectedGift.stock != null ? <> · Estoque disponível: <span className="font-semibold text-foreground">{selectedGift.stock}</span></> : null}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="redemption-responsible" className="text-[11px] uppercase tracking-wider text-muted-foreground">Responsável pela entrega</Label>
              <Input
                id="redemption-responsible"
                value={responsible}
                onChange={(event) => setResponsible(event.target.value)}
                placeholder="Responsável pela entrega"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="redemption-notes" className="text-[11px] uppercase tracking-wider text-muted-foreground">Observações (opcional)</Label>
              <textarea
                id="redemption-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Observações (opcional)"
                className="min-h-[88px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              />
            </div>

            {isBlocked && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.06] p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Saldo insuficiente</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    O cliente tem {availablePoints.toLocaleString('pt-BR')} pts, mas precisa de {requiredPoints.toLocaleString('pt-BR')} pts.
                  </p>
                </div>
              </div>
            )}

            {isOutOfStock && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div>
                  <p className="text-sm font-semibold text-amber-400">Estoque indisponível</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    A quantidade escolhida é maior que o estoque disponível deste brinde.
                  </p>
                </div>
              </div>
            )}

            {submitError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/[0.06] p-3">
                <p className="text-sm text-destructive">{submitError}</p>
              </div>
            )}
          </div>
          )}

          {!success && (
            <DialogFooter className="border-t border-border px-6 py-4">
              <Button variant="outline" onClick={requestClose} disabled={submitting}>
                Cancelar
              </Button>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={!canConfirm}
                onClick={handleConfirm}
              >
                {submitting ? <><Spinner size="sm" /> Registrando...</> : 'Confirmar resgate'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <DialogContent className="max-w-sm border-border bg-card">
          <DialogHeader>
            <DialogTitle>Sair sem salvar?</DialogTitle>
            <DialogDescription>
              {LEAVE_WARNING_MESSAGE}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveConfirm(false)}>
              Continuar editando
            </Button>
            <Button variant="destructive" onClick={confirmClose}>
              Sair sem salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
