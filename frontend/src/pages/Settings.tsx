import { useState, useEffect, FormEvent, useRef } from 'react'
import { Link } from 'react-router-dom'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import AlertBanner from '@/components/AlertBanner'
import { friendlyError } from '@/lib/friendly-errors'
import {
  fetchTenantSettings,
  resolveCurrentTenant,
  saveTenantSettings,
  fetchIxcConnections,
  fetchAllTenants,
  createIxcConnection,
  updateIxcConnection,
  activateIxcConnection,
  deactivateIxcConnection,
  type TenantSettings,
  type IxcConnectionDetail,
  type TenantListItem,
} from '@/lib/supabase-queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Briefcase, Building2, Megaphone, Plus, Pencil, Save, UserCog, Wifi, WifiOff, X } from 'lucide-react'
import Spinner from '@/components/Spinner'
import { createButtonGuard } from '@/utils/antiFlood'

const SETTINGS_CACHE_TTL_MS = 60_000
const settingsCache = new Map<string, { expiresAt: number; settings: TenantSettings | null }>()

function AdminLinkCard({ to, icon: Icon, label, description }: { to: string; icon: React.ElementType; label: string; description: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4 transition-all duration-200 hover:border-primary/30 hover:bg-primary/[0.04]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  )
}

interface ConnectionFormState {
  name: string
  ixcBaseUrl: string
  ixcUser: string
  ixcToken: string
}

const emptyForm = (): ConnectionFormState => ({ name: '', ixcBaseUrl: '', ixcUser: '', ixcToken: '' })

export default function SettingsPage() {
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [connections, setConnections] = useState<IxcConnectionDetail[]>([])
  const [tenants, setTenants] = useState<TenantListItem[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  // Tenant name form (existing single-connection compatibility)
  const [tenantName, setTenantName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  const submitGuardRef = useRef(createButtonGuard('settings-submit'))

  // Connection dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConnection, setEditingConnection] = useState<IxcConnectionDetail | null>(null)
  const [formState, setFormState] = useState<ConnectionFormState>(emptyForm())
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [dialogSaving, setDialogSaving] = useState(false)
  const [dialogError, setDialogError] = useState('')

  // Action state
  const [actionId, setActionId] = useState<string | null>(null)

  const loadData = async (force = false, overrideTenantId?: string) => {
    const effectiveTenantId = overrideTenantId || selectedTenantId
    const cached = effectiveTenantId ? settingsCache.get(effectiveTenantId) : null
    if (!force && cached && cached.expiresAt > Date.now()) {
      setSettings(cached.settings)
      setTenantName(cached.settings?.name ?? '')
      setLoading(false)
      return
    }

    setLoading(true)
    setPageError('')
    try {
      const resolved = await resolveCurrentTenant()
      if (resolved.error === 'no_session') { setPageError('Sessão expirada. Saia e entre novamente.'); return }
      if (resolved.error === 'no_user_record') { setPageError('Sessão inválida ou usuário sem cadastro. Saia e entre novamente.'); return }
      if (resolved.error === 'no_tenant' && !resolved.isFullAdmin) { setPageError('Usuário não associado a um tenant.'); return }
      const tenantList = await fetchAllTenants()
      setTenants(tenantList)
      const tenantId = overrideTenantId || selectedTenantId || resolved.tenantId || tenantList[0]?.id
      if (!tenantId) { setPageError('Empresa não encontrada.'); return }
      if (!selectedTenantId) setSelectedTenantId(tenantId)

      const [data, conns] = await Promise.all([
        fetchTenantSettings(tenantId),
        fetchIxcConnections(tenantId).catch(() => [] as IxcConnectionDetail[]),
      ])

      if (!data) { setPageError('Configurações não encontradas.'); return }

      setSettings(data)
      setTenantName(data.name ?? '')
      setConnections(conns)
      settingsCache.set(tenantId, { expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS, settings: data })
    } catch (err) {
      setPageError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  const handleSaveTenantName = async (e: FormEvent) => {
    e.preventDefault()
    setSaveError('')
    setSaveSuccess(false)
    if (saving || !submitGuardRef.current.canExecute()) return
    const activeConn = connections.find((c) => c.active) ?? connections[0] ?? null
    if (!activeConn) { setSaveError('Configure uma conexão IXC antes de salvar o nome.'); return }
    setSaving(true)
    try {
      const resolved = await resolveCurrentTenant()
      if (resolved.error) { setSaveError('Sessão inválida.'); return }
      await saveTenantSettings(selectedTenantId || resolved.tenantId!, {
        tenantName: tenantName.trim() || undefined,
        ixcBaseUrl: activeConn.ixc_base_url,
        ixcUser: activeConn.ixc_user,
        connectionId: activeConn.id,
      })
      if (selectedTenantId) settingsCache.delete(selectedTenantId)
      await loadData(true)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(friendlyError(err))
    } finally {
      setSaving(false)
      submitGuardRef.current.reset()
    }
  }

  const openNew = () => {
    setEditingConnection(null)
    setFormState(emptyForm())
    setFormErrors({})
    setDialogError('')
    setDialogOpen(true)
  }

  const openEdit = (conn: IxcConnectionDetail) => {
    setEditingConnection(conn)
    setFormState({ name: conn.name ?? '', ixcBaseUrl: conn.ixc_base_url, ixcUser: conn.ixc_user, ixcToken: '' })
    setFormErrors({})
    setDialogError('')
    setDialogOpen(true)
  }

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {}
    if (!formState.name.trim()) errs.name = 'Nome é obrigatório.'
    if (!formState.ixcBaseUrl.trim()) errs.ixcBaseUrl = 'URL base é obrigatória.'
    if (!formState.ixcUser.trim()) errs.ixcUser = 'Usuário IXC é obrigatório.'
    if (!editingConnection && !formState.ixcToken.trim()) errs.ixcToken = 'Token é obrigatório para nova conexão.'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleDialogSave = async () => {
    if (!validateForm()) return
    setDialogSaving(true)
    setDialogError('')
    try {
      if (editingConnection) {
        await updateIxcConnection(editingConnection.id, {
          tenantId: selectedTenantId,
          name: formState.name.trim(),
          ixcBaseUrl: formState.ixcBaseUrl.trim(),
          ixcUser: formState.ixcUser.trim(),
          ixcToken: formState.ixcToken.trim() || undefined,
        })
      } else {
        await createIxcConnection({
          tenantId: selectedTenantId,
          name: formState.name.trim(),
          ixcBaseUrl: formState.ixcBaseUrl.trim(),
          ixcUser: formState.ixcUser.trim(),
          ixcToken: formState.ixcToken.trim(),
          active: connections.length === 0,
        })
      }
      if (selectedTenantId) settingsCache.delete(selectedTenantId)
      setDialogOpen(false)
      await loadData(true)
    } catch (err) {
      setDialogError(friendlyError(err))
    } finally {
      setDialogSaving(false)
    }
  }

  const handleActivate = async (conn: IxcConnectionDetail) => {
    if (conn.active) return
    setActionId(conn.id)
    try {
      await activateIxcConnection(conn.id, selectedTenantId)
      if (selectedTenantId) settingsCache.delete(selectedTenantId)
      await loadData(true)
    } catch (err) {
      setPageError(friendlyError(err))
    } finally {
      setActionId(null)
    }
  }

  const handleDeactivate = async (conn: IxcConnectionDetail) => {
    if (!conn.active) return
    setActionId(conn.id)
    try {
      await deactivateIxcConnection(conn.id, selectedTenantId)
      if (selectedTenantId) settingsCache.delete(selectedTenantId)
      await loadData(true)
    } catch (err) {
      setPageError(friendlyError(err))
    } finally {
      setActionId(null)
    }
  }

  return (
    <ProtectedRoute allowRoles={['admin']} fullAdminOnly>
      <Layout>
        <div className="page-stack">
          <PageHeader
            icon={Briefcase}
            title="Empresa e integrações"
            subtitle="Área administrativa da empresa, integrações e escopo operacional."
          />

          {loading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : (
            <div className="space-y-8 lg:space-y-10">
              {pageError && <AlertBanner variant="error" message={pageError} />}

              {/* Quick navigation */}
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminLinkCard
                  to="/admin/campanhas"
                  icon={Megaphone}
                  label="Campanhas e regras de pontos"
                  description="Defina faixas de pontuação e regras de antecedência."
                />
                <AdminLinkCard
                  to="/admin/usuarios"
                  icon={UserCog}
                  label="Usuários e permissões"
                  description="Gerencie acessos de administradores e operadores."
                />
              </div>

              {/* Tenant name */}
              {tenants.length > 0 && (
                <Card>
                  <CardHeader className="border-b border-[hsl(var(--border))]">
                    <CardTitle>Empresa selecionada</CardTitle>
                    <CardDescription>Escolha a empresa/base IXC para visualizar e gerenciar.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Select
                      value={selectedTenantId}
                      onValueChange={(nextTenantId) => {
                        setSelectedTenantId(nextTenantId)
                        settingsCache.delete(nextTenantId)
                        void loadData(true, nextTenantId)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              )}

              {/* Tenant name */}
              <Card>
                <CardHeader className="border-b border-[hsl(var(--border))]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Nome da empresa</CardTitle>
                      <CardDescription>Nome exibido na plataforma.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleSaveTenantName} className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    {saveError && <AlertBanner variant="error" message={saveError} />}
                    {saveSuccess && <AlertBanner variant="success" message="Nome salvo com sucesso." />}
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="tenantName">Nome da empresa</Label>
                      <Input
                        id="tenantName"
                        value={tenantName}
                        onChange={(e) => setTenantName(e.target.value)}
                        placeholder="Minha Telecom Ltda."
                      />
                    </div>
                    <Button type="submit" disabled={saving} className="gap-2 sm:w-auto">
                      {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
                      {saving ? 'Salvando...' : 'Salvar nome'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* IXC Connections list */}
              <Card>
                <CardHeader className="border-b border-[hsl(var(--border))]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Wifi className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle>Conexões IXC</CardTitle>
                        <CardDescription>Bases IXC configuradas para este tenant.</CardDescription>
                      </div>
                    </div>
                    <Button size="sm" onClick={openNew} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Nova conexão
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {connections.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <WifiOff className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Nenhuma conexão IXC configurada.</p>
                      <Button size="sm" variant="outline" onClick={openNew} className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar primeira conexão
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-[hsl(var(--border))]">
                      {connections.map((conn) => (
                        <div key={conn.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            {conn.active ? (
                              <Wifi className="h-4 w-4 shrink-0 text-emerald-400" />
                            ) : (
                              <WifiOff className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium text-foreground">{conn.name || 'Sem nome'}</p>
                                {conn.active && (
                                  <span className="badge-status badge-status--active">Ativa</span>
                                )}
                              </div>
                              <p className="truncate text-xs text-muted-foreground">{conn.ixc_base_url}</p>
                              <p className="text-xs text-muted-foreground/60">Usuário: {conn.ixc_user}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {!conn.active && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actionId === conn.id}
                                onClick={() => handleActivate(conn)}
                                className="gap-1.5 text-xs"
                              >
                                {actionId === conn.id ? <Spinner size="sm" /> : <Wifi className="h-3 w-3" />}
                                Ativar
                              </Button>
                            )}
                            {conn.active && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actionId === conn.id}
                                onClick={() => handleDeactivate(conn)}
                                className="gap-1.5 text-xs text-muted-foreground"
                              >
                                {actionId === conn.id ? <Spinner size="sm" /> : <X className="h-3 w-3" />}
                                Desativar
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(conn)}
                              className="gap-1.5 text-xs"
                            >
                              <Pencil className="h-3 w-3" />
                              Editar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Connection dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingConnection ? 'Editar conexão IXC' : 'Nova conexão IXC'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {dialogError && <AlertBanner variant="error" message={dialogError} />}
              <div className="space-y-2">
                <Label htmlFor="conn-name">Nome da conexão</Label>
                <Input
                  id="conn-name"
                  value={formState.name}
                  onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Matriz, Filial SP, etc."
                  className={formErrors.name ? 'border-destructive/50' : ''}
                />
                {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="conn-url">URL base do IXC</Label>
                <Input
                  id="conn-url"
                  type="url"
                  value={formState.ixcBaseUrl}
                  onChange={(e) => setFormState((s) => ({ ...s, ixcBaseUrl: e.target.value }))}
                  placeholder="https://ixc.suaempresa.com.br"
                  className={formErrors.ixcBaseUrl ? 'border-destructive/50' : ''}
                />
                {formErrors.ixcBaseUrl && <p className="text-xs text-destructive">{formErrors.ixcBaseUrl}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="conn-user">Usuário IXC</Label>
                <Input
                  id="conn-user"
                  value={formState.ixcUser}
                  onChange={(e) => setFormState((s) => ({ ...s, ixcUser: e.target.value }))}
                  placeholder="usuario_api"
                  className={formErrors.ixcUser ? 'border-destructive/50' : ''}
                />
                {formErrors.ixcUser && <p className="text-xs text-destructive">{formErrors.ixcUser}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="conn-token">
                  Token IXC
                  {editingConnection && (
                    <span className="ml-1.5 text-muted-foreground/60">(deixe vazio para manter o atual)</span>
                  )}
                </Label>
                <Input
                  id="conn-token"
                  type="password"
                  value={formState.ixcToken}
                  onChange={(e) => setFormState((s) => ({ ...s, ixcToken: e.target.value }))}
                  placeholder={editingConnection ? '••••••••' : 'seu-token-ixc'}
                  className={formErrors.ixcToken ? 'border-destructive/50' : ''}
                />
                {formErrors.ixcToken && <p className="text-xs text-destructive">{formErrors.ixcToken}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={dialogSaving}>
                Cancelar
              </Button>
              <Button onClick={handleDialogSave} disabled={dialogSaving} className="gap-2">
                {dialogSaving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
                {dialogSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Layout>
    </ProtectedRoute>
  )
}
