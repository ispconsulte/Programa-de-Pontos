import { useState } from 'react'
import AlertBanner from '@/components/AlertBanner'
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
import { grantManualPoints } from '@/lib/loyalty-admin'
import { fetchCurrentUserProfile } from '@/lib/user-management'
import type { CampaignClientRow } from '@/lib/supabase-queries'
import { Plus } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function ManualPointsDialog({
  client,
  onCompleted,
  trigger,
}: {
  client: CampaignClientRow | null
  onCompleted?: () => Promise<void> | void
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [points, setPoints] = useState('5')
  const [reason, setReason] = useState('')
  const [adjustmentType, setAdjustmentType] = useState<'credit' | 'debit'>('credit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!client) return
    const parsedPoints = Number(points)
    if (!Number.isFinite(parsedPoints) || parsedPoints <= 0) {
      setError('Informe uma quantidade válida de pontos.')
      return
    }
    if (!reason.trim()) {
      setError('Informe o motivo do ajuste manual.')
      return
    }
    if (adjustmentType === 'debit' && parsedPoints > Number(client.pontos_disponiveis ?? 0)) {
      setError('O débito manual não pode exceder o saldo disponível do cliente.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await fetchCurrentUserProfile()
      await grantManualPoints({
        client,
        points: parsedPoints,
        reason: reason.trim(),
        adjustmentType,
      })
      await onCompleted?.()
      setPoints('5')
      setReason('')
      setAdjustmentType('credit')
      setOpen(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível adicionar os pontos.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="bg-emerald-600 text-white hover:bg-emerald-500" disabled={!client}>
            <Plus className="h-3.5 w-3.5" />
            Adicionar pontos manualmente
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar pontos do cliente</DialogTitle>
          <DialogDescription>
            Registre um crédito ou débito manual com motivo obrigatório para o cliente selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && <AlertBanner variant="error" message={error} />}

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium text-foreground">{client?.nome_cliente ?? 'Cliente'}</p>
            <p className="text-muted-foreground">Saldo atual: {client?.pontos_disponiveis?.toLocaleString('pt-BR') ?? '--'} pts</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-adjustment-type">Tipo de ajuste</Label>
            <Select value={adjustmentType} onValueChange={(value: 'credit' | 'debit') => setAdjustmentType(value)}>
              <SelectTrigger id="manual-adjustment-type">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit">Crédito manual</SelectItem>
                <SelectItem value="debit">Débito manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-points">Pontos</Label>
            <Input
              id="manual-points"
              type="number"
              min="1"
              step="1"
              value={points}
              onChange={(event) => setPoints(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-reason">Motivo</Label>
            <Input
              id="manual-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Motivo obrigatório do ajuste manual"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Salvando...' : 'Confirmar ajuste'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
