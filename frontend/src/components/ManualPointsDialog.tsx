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
  const [description, setDescription] = useState('Bonificação manual para validação operacional')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!client) return
    const parsedPoints = Number(points)
    if (!Number.isFinite(parsedPoints) || parsedPoints <= 0) {
      setError('Informe uma quantidade válida de pontos.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const profile = await fetchCurrentUserProfile()
      await grantManualPoints({
        client,
        points: parsedPoints,
        description: description.trim() || 'Bonificação manual',
        actorName: profile.name || profile.email,
      })
      await onCompleted?.()
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
          <DialogTitle>Injetar pontos no cliente</DialogTitle>
          <DialogDescription>
            Registre um crédito manual persistido para o cliente selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && <AlertBanner variant="error" message={error} />}

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium text-foreground">{client?.nome_cliente ?? 'Cliente'}</p>
            <p className="text-muted-foreground">Saldo atual: {client?.pontos_disponiveis?.toLocaleString('pt-BR') ?? '--'} pts</p>
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
            <Label htmlFor="manual-description">Descrição</Label>
            <Input
              id="manual-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Motivo do crédito manual"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Salvando...' : 'Confirmar pontos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
