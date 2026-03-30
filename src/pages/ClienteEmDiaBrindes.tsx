import PageHeader from '@/components/PageHeader'
import Layout from '@/components/Layout'
import EmptyState from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Gift, Plus } from 'lucide-react'
import { useState } from 'react'

type CatalogFormState = {
  name: string
  requiredPoints: string
}

const emptyForm: CatalogFormState = {
  name: '',
  requiredPoints: '',
}

function GiftCatalogDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CatalogFormState>(emptyForm)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,185,129,0.06),rgba(255,255,255,0)_24%),hsl(var(--background))]">
        <DialogHeader>
          <DialogTitle className="text-white">Adicionar brinde</DialogTitle>
          <DialogDescription>
            Cadastre um novo item apenas quando houver dados validados para nome e pontuacao.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="gift-name" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Nome
            </Label>
            <Input
              id="gift-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nome do brinde"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gift-points" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Pontos necessarios
            </Label>
            <Input
              id="gift-points"
              value={form.requiredPoints}
              onChange={(event) => setForm((current) => ({ ...current, requiredPoints: event.target.value }))}
              placeholder="Informe a pontuacao"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button className="bg-emerald-600 text-white hover:bg-emerald-500" disabled={!form.name.trim() || !form.requiredPoints.trim()}>
            Salvar brinde
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ClienteEmDiaBrindesPage() {
  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          icon={Gift}
          title="Catálogo de Brindes"
          subtitle="Gerencie o portfólio de recompensas da campanha Cliente em Dia com uma visão clara de pontos e disponibilidade."
          actions={
            <GiftCatalogDialog
              trigger={
                <Button className="bg-emerald-600 text-white hover:bg-emerald-500">
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar brinde
                </Button>
              }
            />
          }
        />

        <Card className="overflow-hidden border-emerald-500/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(8,10,15,0)_46%),hsl(var(--surface-1))]">
          <CardContent className="p-5 lg:p-6">
            <EmptyState title="Ainda nao ha registros aqui" description="Nenhum dado encontrado. Adicione o primeiro item quando houver dados validos." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Catálogo oficial de brindes</CardTitle>
            <CardDescription>
              Esta area exibira nome, pontuacao, estoque, imagem e status assim que houver dados reais cadastrados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState title="Ainda nao ha registros aqui" description="Nenhum resultado encontrado. Tente novamente mais tarde." />
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
