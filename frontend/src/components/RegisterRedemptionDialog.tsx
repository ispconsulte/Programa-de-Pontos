import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, Gift, Search, CheckCircle2 } from 'lucide-react'
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

interface GiftOption {
  id: string
  name: string
  requiredPoints: number
  stock: number | null
}

interface RegisterRedemptionDialogProps {
  trigger: ReactNode
  /** Pre-select a client by passing their campaign client data */
  preselectedClient?: CampaignClientRow | null
  onRedemptionComplete?: () => void
}

export default function RegisterRedemptionDialog({
  trigger,
  preselectedClient,
  onRedemptionComplete,
}: RegisterRedemptionDialogProps) {
  const [open, setOpen] = useState(false)

  /* Customer search */
  const [customerQuery, setCustomerQuery] = useState('')
  const [suggestions, setSuggestions] = useState<CampaignClientRow[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<CampaignClientRow | null>(null)

  /* Gifts */
  const [gifts, setGifts] = useState<GiftOption[]>([])
  const [selectedGiftId, setSelectedGiftId] = useState('')
  const [giftsLoading, setGiftsLoading] = useState(false)

  /* Form */
  const [responsible, setResponsible] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<RewardRedemptionResult | null>(null)
  const [submitError, setSubmitError] = useState('')

  const selectedGift = useMemo(() => gifts.find(g => g.id === selectedGiftId) ?? null, [gifts, selectedGiftId])
  const availablePoints = selectedClient?.pontos_disponiveis ?? 0
  const requiredPoints = selectedGift?.requiredPoints ?? 0
  const isOutOfStock = !!selectedGift && selectedGift.stock != null && selectedGift.stock <= 0
  const isBlocked = !!selectedGift && !!selectedClient && availablePoints < requiredPoints
  const canConfirm = !!selectedClient && !!selectedGift && !!responsible.trim() && !isBlocked && !isOutOfStock && !submitting

  /* Load gifts on open */
  useEffect(() => {
    if (!open) return
    let mounted = true
    const loadGifts = async () => {
      setGiftsLoading(true)
      try {
        const data = await fetchRewardCatalogItems()
        if (!mounted) return
        setGifts((data ?? [])
          .filter((g) => g.ativo)
          .map((g) => ({
          id: g.id,
          name: g.nome,
          requiredPoints: g.pontos_necessarios,
          stock: g.estoque ?? null,
        })))
      } catch {
        if (!mounted) return
        setGifts([])
      }
      finally { if (mounted) setGiftsLoading(false) }
    }
    loadGifts()
    return () => { mounted = false }
  }, [open])

  /* Reset form on open */
  useEffect(() => {
    if (!open) return
    setSelectedGiftId('')
    setResponsible('')
    setNotes('')
    setSubmitError('')
    setSuccess(null)

    if (preselectedClient) {
      setSelectedClient(preselectedClient)
      setCustomerQuery(preselectedClient.nome_cliente || '')
      setSuggestions([])
    } else {
      setSelectedClient(null)
      setCustomerQuery('')
      setSuggestions([])
    }
  }, [open, preselectedClient])

  /* Search customers */
  const searchCustomers = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setSuggestions([]); return }
    setSearchLoading(true)
    try {
      const tenantId = await getCurrentTenantId()
      if (!tenantId) return
      const results = await autocompleteCampaignClients({ tenantId, query })
      setSuggestions(results)
    } catch { setSuggestions([]) }
    finally { setSearchLoading(false) }
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setCustomerQuery(value)
    setSelectedClient(null)
    const timer = setTimeout(() => searchCustomers(value), 300)
    return () => clearTimeout(timer)
  }, [searchCustomers])

  const selectCustomer = useCallback((client: CampaignClientRow) => {
    setSelectedClient(client)
    setCustomerQuery(client.nome_cliente || '')
    setSuggestions([])
  }, [])

  /* Submit */
  const handleConfirm = async () => {
    if (!canConfirm || !selectedClient || !selectedGift) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await registerRewardRedemption({
        client: selectedClient,
        reward: {
          id: selectedGift.id,
          nome: selectedGift.name,
          descricao: null,
          pontos_necessarios: selectedGift.requiredPoints,
          ativo: true,
          estoque: selectedGift.stock,
          imagem_url: null,
        } as RewardCatalogRow,
        responsible,
        notes,
      })

      setSuccess(result)
      setTimeout(() => {
        setOpen(false)
        onRedemptionComplete?.()
      }, 1500)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao registrar resgate.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg border-border bg-card p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <Gift className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <DialogTitle className="text-base">Registrar resgate</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                Selecione o cliente e o brinde para registrar a entrega.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <p className="mt-4 text-lg font-bold text-foreground">Resgate registrado!</p>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              {selectedClient?.nome_cliente} resgatou <span className="font-semibold text-foreground">{success.redemption.brinde_nome}</span>.
            </p>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Saldo restante: <span className="font-semibold text-foreground">{success.remainingPoints.toLocaleString('pt-BR')} pts</span>
              {success.remainingStock != null ? <> · Estoque restante: <span className="font-semibold text-foreground">{success.remainingStock}</span></> : null}
            </p>
          </div>
        ) : (
          <div className="space-y-4 px-6 pb-2">
            {/* Customer selection */}
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Cliente</Label>
              {preselectedClient && selectedClient ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-400">
                    {(selectedClient.nome_cliente?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{selectedClient.nome_cliente}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedClient.pontos_disponiveis?.toLocaleString('pt-BR') ?? 0} pts disponíveis
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={customerQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Nome ou CPF do cliente"
                    className="pl-9"
                  />
                  {searchLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Spinner size="sm" /></div>}
                  {suggestions.length > 0 && !selectedClient && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
                      {suggestions.map((c) => (
                        <button key={c.id} type="button" onClick={() => selectCustomer(c)}
                          className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-muted text-sm">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{c.nome_cliente}</p>
                            <p className="text-xs text-muted-foreground">{c.documento || `IXC #${c.ixc_cliente_id}`}</p>
                          </div>
                          <span className="text-xs font-bold text-emerald-400 shrink-0 ml-2">
                            {(c.pontos_disponiveis ?? 0).toLocaleString('pt-BR')} pts
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected client info */}
            {selectedClient && !preselectedClient && (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-400">
                  {(selectedClient.nome_cliente?.[0] || '?').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{selectedClient.nome_cliente}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedClient.pontos_disponiveis?.toLocaleString('pt-BR') ?? 0} pts disponíveis
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setSelectedClient(null); setCustomerQuery('') }}>
                  Trocar
                </Button>
              </div>
            )}

            {/* Gift selection */}
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Brinde</Label>
              {giftsLoading ? (
                <div className="flex items-center justify-center py-4"><Spinner size="sm" /></div>
              ) : (
                <Select value={selectedGiftId} onValueChange={setSelectedGiftId}>
                  <SelectTrigger>
                    <SelectValue placeholder={gifts.length === 0 ? 'Nenhum brinde cadastrado' : 'Escolha o brinde'} />
                  </SelectTrigger>
                  <SelectContent>
                    {gifts.map((g) => (
                      <SelectItem key={g.id} value={g.id} disabled={g.stock != null && g.stock <= 0}>
                        {g.name} — {g.requiredPoints} pts{g.stock != null ? ` • estoque ${g.stock}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedGift?.stock != null && (
              <p className="text-xs text-muted-foreground">
                Estoque atual: <span className="font-semibold text-foreground">{selectedGift.stock}</span>
              </p>
            )}

            {/* Responsible */}
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Responsável pela entrega</Label>
              <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Nome do responsável" />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Observações <span className="text-muted-foreground/50">(opcional)</span></Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações sobre a entrega"
                className="min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              />
            </div>

            {/* Blocked warning */}
            {isBlocked && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.06] p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Saldo insuficiente</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    O cliente tem {availablePoints.toLocaleString('pt-BR')} pts, mas precisa de {requiredPoints.toLocaleString('pt-BR')} pts.
                  </p>
                </div>
              </div>
            )}

            {isOutOfStock && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-400">Estoque indisponível</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Este brinde está cadastrado, mas o estoque atual está zerado. Escolha outro item para continuar.
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
          <DialogFooter className="px-6 py-4 border-t border-border">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancelar</Button>
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
  )
}
