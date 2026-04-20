import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import PageHeader from '@/components/PageHeader'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import EmptyState from '@/components/EmptyState'
import AlertBanner from '@/components/AlertBanner'
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
import { useClienteEmDia, type ClienteEmDiaRewardItem } from '@/hooks/useClienteEmDia'
import {
  createRewardCatalogItem,
  deleteRewardCatalogItem,
  readImageAsDataUrl,
  updateRewardCatalogItem,
} from '@/lib/loyalty-admin'
import { fetchCurrentUserProfile, isAdminUiRole } from '@/lib/user-management'
import {
  AlertTriangle,
  Award,
  Box,
  CheckCircle,
  Gift,
  Package,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react'

type CatalogFormState = {
  name: string
  description: string
  requiredPoints: string
  stock: string
  imageUrl: string
  active: boolean
}

const emptyForm: CatalogFormState = {
  name: '',
  description: '',
  requiredPoints: '',
  stock: '',
  imageUrl: '',
  active: true,
}

function toFormState(reward?: ClienteEmDiaRewardItem | null): CatalogFormState {
  if (!reward) return emptyForm
  return {
    name: reward.nome,
    description: reward.descricao ?? '',
    requiredPoints: String(reward.pontosNecessarios),
    stock: reward.estoqueDisponivel == null ? '' : String(reward.estoqueDisponivel),
    imageUrl: reward.imagemUrl ?? '',
    active: reward.ativo,
  }
}

function GiftCatalogDialog({
  trigger,
  reward,
  onSaved,
}: {
  trigger: React.ReactNode
  reward?: ClienteEmDiaRewardItem | null
  onSaved: (message: string) => Promise<void> | void
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CatalogFormState>(toFormState(reward))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isEditing = !!reward

  useEffect(() => {
    if (open) {
      setForm(toFormState(reward))
      setError('')
    }
  }, [open, reward])

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Formato inválido. Envie imagens nos formatos JPG, PNG ou WebP.')
      event.target.value = ''
      return
    }

    try {
      const imageUrl = await readImageAsDataUrl(file)
      setForm((current) => ({ ...current, imageUrl }))
      setError('')
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : 'Não foi possível carregar a imagem.')
    } finally {
      event.target.value = ''
    }
  }

  async function handleSubmit() {
    const requiredPoints = Number(form.requiredPoints)
    const stockValue = form.stock.trim() ? Number(form.stock) : null

    if (!form.name.trim()) {
      setError('Informe o nome do brinde.')
      return
    }
    if (!Number.isFinite(requiredPoints) || requiredPoints <= 0) {
      setError('Informe uma pontuação válida para o brinde.')
      return
    }
    if (stockValue != null && (!Number.isFinite(stockValue) || stockValue < 0)) {
      setError('O estoque precisa ser vazio ou um número maior ou igual a zero.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const payload = {
        name: form.name,
        description: form.description,
        requiredPoints,
        stock: stockValue,
        imageUrl: form.imageUrl || null,
        active: form.active,
        reason: isEditing ? 'Atualização do catálogo administrativo' : 'Criação do catálogo administrativo',
        expectedUpdatedAt: reward?.updatedAt ?? null,
      }

      if (reward) {
        await updateRewardCatalogItem(reward.id, payload)
        await onSaved(`Brinde "${form.name}" atualizado com sucesso.`)
      } else {
        await createRewardCatalogItem(payload)
        await onSaved(`Brinde "${form.name}" criado com sucesso.`)
      }

      setOpen(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar o brinde.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg border-[hsl(var(--border))] bg-[hsl(var(--background))]">
        <DialogHeader>
          <DialogTitle className="text-foreground">{isEditing ? 'Editar brinde' : 'Novo brinde'}</DialogTitle>
          <DialogDescription>
            Preencha as informações abaixo para {isEditing ? 'atualizar' : 'cadastrar'} o brinde no catálogo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-4 sm:px-6">
          {error && <AlertBanner variant="error" message={error} />}

          <div className="space-y-1.5">
            <Label htmlFor="gift-name" className="text-xs font-medium text-muted-foreground">Nome</Label>
            <Input
              id="gift-name"
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              placeholder="Ex.: Mousepad, squeeze, camiseta"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gift-description" className="text-xs font-medium text-muted-foreground">Descrição</Label>
            <Input
              id="gift-description"
              value={form.description}
              onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
              placeholder="Breve descrição do item"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="gift-points" className="text-xs font-medium text-muted-foreground">Pontos</Label>
              <Input
                id="gift-points"
                type="number"
                min="1"
                step="1"
                value={form.requiredPoints}
                onChange={(e) => setForm((c) => ({ ...c, requiredPoints: e.target.value }))}
                placeholder="Ex.: 50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gift-stock" className="text-xs font-medium text-muted-foreground">Estoque</Label>
              <Input
                id="gift-stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(e) => setForm((c) => ({ ...c, stock: e.target.value }))}
                placeholder="Vazio = ilimitado"
              />
            </div>
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">Imagem</Label>
              <Label
                htmlFor="gift-image"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Upload className="h-3.5 w-3.5" />
                {form.imageUrl ? 'Trocar' : 'Enviar'}
              </Label>
            </div>
            <input id="gift-image" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} />

            <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/15 p-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card">
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt={form.name || 'Preview'} width={64} height={64} loading="lazy" decoding="async" className="h-full w-full object-contain p-1" />
                ) : (
                  <Gift className="h-5 w-5 text-muted-foreground/40" />
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                JPG, PNG ou WebP · até 1,5 MB · ideal 400×400 px
              </p>
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((c) => ({ ...c, active: e.target.checked }))}
              className="h-4 w-4 rounded border-border"
            />
            Brinde ativo para resgate
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="success" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar brinde'}
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

function GiftCardVisual({ reward }: { reward: ClienteEmDiaRewardItem }) {
  const tier = tierColor(reward.pontosNecessarios)
  const initials = reward.nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  if (reward.imagemUrl) {
    return (
      <img
        src={reward.imagemUrl}
        alt={reward.nome}
        width={400}
        height={400}
        className="h-full w-full object-contain p-2"
        loading="lazy"
        decoding="async"
      />
    )
  }

  return (
    <div className={`relative h-full w-full overflow-hidden bg-gradient-to-br ${tier.accent} via-transparent to-slate-950/20`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.22),transparent_38%)]" />
      <div className="absolute right-3 top-3 opacity-15">{tierIcon(reward.pontosNecessarios)}</div>
      <div className="relative flex h-full items-end justify-between p-4">
        <div>
          <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 ${tier.bg} ${tier.text}`}>
            <span className="text-sm font-black tracking-[0.2em]">{initials || 'GD'}</span>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Catálogo</p>
          <p className="mt-1 text-xs font-medium text-foreground/90">Imagem demonstrativa indisponível</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold ${tier.text}`}>
          {tierIcon(reward.pontosNecessarios)}
          Visual
        </span>
      </div>
    </div>
  )
}

export default function ClienteEmDiaBrindesPage() {
  const { loading, error, rewards, reload } = useClienteEmDia({ rewardsOnly: true })
  const [isAdmin, setIsAdmin] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ClienteEmDiaRewardItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    void fetchCurrentUserProfile()
      .then((profile) => setIsAdmin(isAdminUiRole(profile.role)))
      .catch(() => setIsAdmin(false))
  }, [])

  const filteredRewards = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rewards
    return rewards.filter((reward) => (
      [reward.nome, reward.descricao, String(reward.pontosNecessarios)]
        .map((value) => String(value ?? '').toLowerCase())
        .some((value) => value.includes(term))
    ))
  }, [rewards, search])

  async function handleSaved(message: string) {
    setFeedback({ type: 'success', message })
    await reload()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteRewardCatalogItem(deleteTarget.id, {
        expectedUpdatedAt: deleteTarget.updatedAt,
        reason: 'Exclusão solicitada pela interface administrativa',
      })
      setFeedback({ type: 'success', message: `Brinde "${deleteTarget.nome}" excluído com sucesso.` })
      setDeleteTarget(null)
      await reload()
    } catch (deleteError) {
      setFeedback({
        type: 'error',
        message: deleteError instanceof Error ? deleteError.message : 'Não foi possível excluir o brinde.',
      })
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

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
                onSaved={handleSaved}
                trigger={
                  <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-500 sm:w-auto">
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar brinde
                  </Button>
                }
              />
            ) : undefined}
          />

          {feedback && (
            <AlertBanner
              variant={feedback.type}
              message={feedback.message}
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
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

          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div className="relative rounded-xl border border-border bg-background/80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-11 border-0 bg-transparent pl-9 pr-3 shadow-none focus-visible:ring-0"
                  placeholder="Buscar por nome, descrição ou pontuação"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">Catálogo de brindes</CardTitle>
                  <CardDescription className="mt-0.5 text-xs">
                    Nome, pontuação, estoque, imagem e status de cada recompensa cadastrada.
                  </CardDescription>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">{filteredRewards.length}</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8"><EmptyState title="Carregando catálogo" description="Consultando dados reais do catálogo." /></div>
              ) : error ? (
                <div className="p-8"><EmptyState title="Falha ao carregar catálogo" description={error} /></div>
              ) : filteredRewards.length === 0 ? (
                <div className="p-8"><EmptyState title="Nenhum brinde encontrado" description="Ajuste a busca ou cadastre um novo item." /></div>
              ) : (
                <div className="grid gap-px bg-border/30 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredRewards.map((reward) => {
                    const tier = tierColor(reward.pontosNecessarios)
                    return (
                      <div
                        key={reward.id}
                        className="group relative flex min-w-0 flex-col bg-card p-4 sm:p-5 transition-colors hover:bg-muted/20"
                      >
                        <div className={`mb-4 flex h-28 w-full items-center justify-center overflow-hidden rounded-xl border border-border/50 ${tier.bg}`}>
                          <GiftCardVisual reward={reward} />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 text-sm font-bold leading-snug text-foreground">{reward.nome}</p>
                            <span className={`mt-0.5 shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                              reward.ativo
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              {reward.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{reward.descricao ?? 'Sem descrição cadastrada.'}</p>
                        </div>

                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className={`rounded-lg border ${tier.border} bg-gradient-to-r ${tier.accent} to-transparent px-3 py-1.5`}>
                            <p className={`text-sm font-bold ${tier.text}`}>{reward.pontosNecessarios} pts</p>
                          </div>
                          <span className="inline-flex items-center gap-1 self-start rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:self-auto">
                            <Box className="h-2.5 w-2.5" />
                            {reward.estoqueDisponivel == null ? 'Ilimitado' : `${reward.estoqueDisponivel} em estoque`}
                          </span>
                        </div>

                        {isAdmin && (
                          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                            <GiftCatalogDialog
                              reward={reward}
                              onSaved={handleSaved}
                              trigger={
                                <Button variant="outline" size="sm" className="flex-1">
                                  <Pencil className="h-3.5 w-3.5" />
                                  Editar
                                </Button>
                              }
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(reward)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Delete confirmation dialog */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
          <DialogContent className="max-w-sm bg-[hsl(var(--background))]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar exclusão
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir o brinde <strong className="text-foreground">"{deleteTarget?.nome}"</strong>? Essa ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => void confirmDelete()}
                disabled={deleting}
              >
                {deleting ? 'Excluindo...' : 'Sim, excluir'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Layout>
    </ProtectedRoute>
  )
}
