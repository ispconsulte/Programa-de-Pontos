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
      <DialogContent className="max-w-xl border-[hsl(var(--border))] bg-[linear-gradient(180deg,rgba(16,185,129,0.06),rgba(255,255,255,0)_24%),hsl(var(--background))]">
        <DialogHeader>
          <DialogTitle className="text-foreground">{isEditing ? 'Editar brinde' : 'Adicionar brinde'}</DialogTitle>
          <DialogDescription>
            Cadastre o item com nome, pontuação, estoque e uma imagem real para facilitar o resgate.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {error && <AlertBanner variant="error" message={error} />}

          <div className="space-y-2">
            <Label htmlFor="gift-name" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Nome
            </Label>
            <Input
              id="gift-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Mousepad, squeeze, camiseta..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gift-description" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Descrição
            </Label>
            <Input
              id="gift-description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Descrição curta do item"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gift-points" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Pontos necessários
              </Label>
              <Input
                id="gift-points"
                type="number"
                min="1"
                step="1"
                value={form.requiredPoints}
                onChange={(event) => setForm((current) => ({ ...current, requiredPoints: event.target.value }))}
                placeholder="Informe a pontuação"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gift-stock" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Estoque
              </Label>
              <Input
                id="gift-stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value }))}
                placeholder="Deixe vazio para ilimitado"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="gift-image" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Imagem do brinde
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">Envie um arquivo real de imagem ou mantenha a existente.</p>
              </div>
              <Label
                htmlFor="gift-image"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Upload className="h-4 w-4" />
                Subir imagem
              </Label>
            </div>
            <input id="gift-image" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-border bg-card">
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt={form.name || 'Pré-visualização'} className="h-full w-full object-contain p-2" />
                ) : (
                  <span className="text-xs text-muted-foreground">Sem imagem</span>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Pré-visualização</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  A imagem fica salva diretamente no catálogo e aparece no resgate.
                </p>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
            />
            Brinde ativo para resgate
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => void handleSubmit()} disabled={saving}>
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

export default function ClienteEmDiaBrindesPage() {
  const { loading, error, rewards, reload } = useClienteEmDia({ rewardsOnly: true })
  const [isAdmin, setIsAdmin] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [search, setSearch] = useState('')

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

  async function handleDelete(reward: ClienteEmDiaRewardItem) {
    if (!window.confirm(`Excluir o brinde "${reward.nome}"?`)) return

    try {
      await deleteRewardCatalogItem(reward.id)
      setFeedback({ type: 'success', message: `Brinde "${reward.nome}" excluído com sucesso.` })
      await reload()
    } catch (deleteError) {
      setFeedback({
        type: 'error',
        message: deleteError instanceof Error ? deleteError.message : 'Não foi possível excluir o brinde.',
      })
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
                  <Button className="bg-emerald-600 text-white hover:bg-emerald-500">
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

          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
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
                <div className="grid gap-px bg-border/30 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredRewards.map((reward) => {
                    const tier = tierColor(reward.pontosNecessarios)
                    return (
                      <div
                        key={reward.id}
                        className="group relative flex flex-col bg-card p-5 transition-colors hover:bg-muted/20"
                      >
                        <div className={`mb-4 flex h-28 w-full items-center justify-center overflow-hidden rounded-xl border border-border/50 ${tier.bg}`}>
                          {reward.imagemUrl ? (
                            <img
                              src={reward.imagemUrl}
                              alt={reward.nome}
                              className="h-full w-full object-contain p-2"
                              loading="lazy"
                            />
                          ) : (
                            <span className={`inline-flex items-center gap-2 text-xs ${tier.text}`}>{tierIcon(reward.pontosNecessarios)} Sem imagem</span>
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-foreground leading-snug">{reward.nome}</p>
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

                        <div className="mt-3 flex items-center justify-between">
                          <div className={`rounded-lg border ${tier.border} bg-gradient-to-r ${tier.accent} to-transparent px-3 py-1.5`}>
                            <p className={`text-sm font-bold ${tier.text}`}>{reward.pontosNecessarios} pts</p>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <Box className="h-2.5 w-2.5" />
                            {reward.estoqueDisponivel == null ? 'Ilimitado' : `${reward.estoqueDisponivel} em estoque`}
                          </span>
                        </div>

                        {isAdmin && (
                          <div className="mt-4 flex gap-2">
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
                              onClick={() => void handleDelete(reward)}
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
      </Layout>
    </ProtectedRoute>
  )
}
