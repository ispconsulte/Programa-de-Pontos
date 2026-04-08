import PageHeader from '@/components/PageHeader'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
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
import { useClienteEmDia } from '@/hooks/useClienteEmDia'
import { Award, Box, CheckCircle, Gift, Package, Plus, Star, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchCurrentUserProfile, isAdminUiRole } from '@/lib/user-management'

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
      <DialogContent className="max-w-xl border-[hsl(var(--border))] bg-[linear-gradient(180deg,rgba(16,185,129,0.06),rgba(255,255,255,0)_24%),hsl(var(--background))]">
        <DialogHeader>
          <DialogTitle className="text-foreground">Adicionar brinde</DialogTitle>
          <DialogDescription>
            Cadastre um novo item apenas quando houver dados validados para nome e pontuação.
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
              Pontos necessários
            </Label>
            <Input
              id="gift-points"
              value={form.requiredPoints}
              onChange={(event) => setForm((current) => ({ ...current, requiredPoints: event.target.value }))}
              placeholder="Informe a pontuação"
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

const tierIcon = (pts: number) => {
  if (pts >= 50) return <Star className="h-4 w-4" />
  if (pts >= 20) return <Award className="h-4 w-4" />
  if (pts >= 10) return <Zap className="h-4 w-4" />
  return <Gift className="h-4 w-4" />
}

const tierColor = (pts: number) => {
  if (pts >= 50) return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/25', accent: 'from-amber-500/10' }
  if (pts >= 20) return { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/25', accent: 'from-violet-500/10' }
  if (pts >= 10) return { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/25', accent: 'from-sky-500/10' }
  return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/25', accent: 'from-emerald-500/10' }
}

export default function ClienteEmDiaBrindesPage() {
  const { loading, error, rewards } = useClienteEmDia({ rewardsOnly: true })
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    void fetchCurrentUserProfile()
      .then((profile) => setIsAdmin(isAdminUiRole(profile.role)))
      .catch(() => setIsAdmin(false))
  }, [])

  const activeCount = rewards.filter((item) => item.ativo).length
  const minPts = rewards[0]?.pontosNecessarios
  const maxPts = rewards.length > 0 ? rewards[rewards.length - 1]?.pontosNecessarios : null

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <PageHeader
            icon={Gift}
            title="Catálogo"
            subtitle="Recompensas disponíveis para consulta operacional e gestão administrativa da empresa."
            actions={isAdmin ? (
              <GiftCatalogDialog
                trigger={
                  <Button className="bg-emerald-600 text-white hover:bg-emerald-500">
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar brinde
                  </Button>
                }
              />
            ) : undefined}
          />

          {/* KPI cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-emerald-500/10 to-emerald-500/[0.02] p-5">
              <div className="flex items-start justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Itens cadastrados</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15"><Package className="h-4 w-4 text-emerald-500" /></div>
              </div>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">{rewards.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Total no catálogo</p>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-sky-500/10 to-sky-500/[0.02] p-5">
              <div className="flex items-start justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Ativos</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15"><CheckCircle className="h-4 w-4 text-sky-500" /></div>
              </div>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">{activeCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Disponíveis para resgate</p>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-amber-500/10 to-amber-500/[0.02] p-5">
              <div className="flex items-start justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Faixa de pontos</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15"><Zap className="h-4 w-4 text-amber-500" /></div>
              </div>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
                {minPts != null ? `${minPts}` : '--'}
                {maxPts != null && maxPts !== minPts ? <span className="text-lg font-bold text-muted-foreground"> – {maxPts}</span> : ''}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Pontos necessários</p>
            </div>
          </div>

          {/* Catalog list */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">Catálogo de brindes</CardTitle>
                  <CardDescription className="mt-0.5 text-xs">
                    Nome, pontuação e status de cada recompensa cadastrada.
                  </CardDescription>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">{rewards.length}</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8"><EmptyState title="Carregando catálogo" description="Consultando dados reais do catálogo." /></div>
              ) : error ? (
                <div className="p-8"><EmptyState title="Falha ao carregar catálogo" description={error} /></div>
              ) : rewards.length === 0 ? (
                <div className="p-8"><EmptyState title="Ainda não há registros aqui" description="Nenhum brinde foi cadastrado." /></div>
              ) : (
                <div className="divide-y divide-border/50">
                  {rewards.map((reward, index) => {
                    const tier = tierColor(reward.pontosNecessarios)
                    return (
                      <div
                        key={reward.id}
                        className={`group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30`}
                      >
                        {/* Icon with tier color */}
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tier.bg} ${tier.text}`}>
                          {tierIcon(reward.pontosNecessarios)}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{reward.nome}</p>
                            {reward.estoqueDisponivel != null && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                <Box className="h-2.5 w-2.5" />{reward.estoqueDisponivel}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{reward.descricao ?? 'Sem descrição cadastrada.'}</p>
                        </div>

                        {/* Points & status */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className={`rounded-lg border ${tier.border} bg-gradient-to-r ${tier.accent} to-transparent px-3 py-1.5`}>
                            <p className={`text-sm font-bold ${tier.text}`}>{reward.pontosNecessarios} pts</p>
                          </div>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            reward.ativo
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {reward.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
