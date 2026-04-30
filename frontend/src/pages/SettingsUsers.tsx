import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import AlertBanner from '@/components/AlertBanner'
import Spinner from '@/components/Spinner'
import StatCard from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  createManagedUser,
  deleteManagedUser,
  disconnectManagedUser,
  fetchCurrentUserProfile,
  fetchManagedUsers,
  isAdminUiRole,
  isFullAdminProfile,
  updateManagedUser,
  type CreateManagedUserInput,
  type CurrentUserProfile,
  type ManagedUser,
} from '@/lib/user-management'
import { fetchAllTenants, fetchRegioes, type TenantListItem, type RegiaoItem } from '@/lib/supabase-queries'
import { Edit3, KeyRound, LogOut, Shield, Trash2, UserCog, UserPlus, Users } from 'lucide-react'
import { friendlyError } from '@/lib/friendly-errors'
import { createButtonGuard } from '@/utils/antiFlood'

const SETTINGS_USERS_CACHE_TTL_MS = 60_000
let settingsUsersCache: {
  expiresAt: number
  currentUser: CurrentUserProfile | null
  users: ManagedUser[]
  tenants: TenantListItem[]
} | null = null

type DialogMode = 'create' | 'edit'
type ManagedUserRole = 'admin' | 'operator' | 'full_admin'

interface UserFormState {
  name: string
  email: string
  password: string
  role: ManagedUserRole
  isActive: boolean
  tenantId: string
  regiaoId: string
}

const initialFormState: UserFormState = {
  name: '',
  email: '',
  password: '',
  role: 'operator',
  isActive: true,
  tenantId: '',
  regiaoId: '',
}

const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_'

function generatePassword(length = 12): string {
  const values = new Uint32Array(length)
  globalThis.crypto.getRandomValues(values)
  return Array.from(values, (value) => PASSWORD_CHARS[value % PASSWORD_CHARS.length]).join('')
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Nunca'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Nunca'
  return parsed.toLocaleString('pt-BR')
}

function roleLabel(user: Pick<ManagedUser, 'role' | 'is_full_admin'>): string {
  if (user.is_full_admin) return 'Full Administrador'
  return isAdminUiRole(user.role) ? 'Administrador' : 'Operador'
}

function tenantLabel(user: Pick<ManagedUser, 'tenant_id' | 'tenant_name'>, tenants: TenantListItem[]): string {
  return user.tenant_name || tenants.find((tenant) => tenant.id === user.tenant_id)?.name || user.tenant_id || '-'
}

/* ── Compact user card for mobile ── */
function UserCard({
  user,
  busy,
  onEdit,
  onDisconnect,
  onDelete,
  tenants,
  canManage,
}: {
  user: ManagedUser
  busy: boolean
  onEdit: () => void
  onDisconnect: () => void
  onDelete: () => void
  tenants: TenantListItem[]
  canManage: boolean
}) {
  const initial = (user.name?.trim()?.[0] || user.email?.[0] || 'U').toUpperCase()

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          <p className="truncate text-xs text-muted-foreground">{tenantLabel(user, tenants)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="badge-status badge-status--role">{roleLabel(user)}</span>
            <span className={user.is_active ? 'badge-status badge-status--active' : 'badge-status badge-status--inactive'}>
              {user.is_active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
        <div>
          <p className="font-medium text-foreground/60">Último login</p>
          <p>{formatDateTime(user.last_sign_in_at)}</p>
        </div>
        <div>
          <p className="font-medium text-foreground/60">Revogação</p>
          <p>{formatDateTime(user.session_revoked_at)}</p>
        </div>
      </div>

      <div className="flex gap-2 border-t border-[hsl(var(--border))] pt-3">
        <Button variant="outline" size="sm" className="flex-1 text-xs" disabled={!canManage} onClick={onEdit}>
          <Edit3 className="h-3 w-3" />
          Editar
        </Button>
        <Button variant="outline" size="sm" className="flex-1 text-xs" disabled={busy || !canManage} onClick={onDisconnect}>
          {busy ? <Spinner size="sm" /> : <LogOut className="h-3 w-3" />}
          {busy ? 'Aguarde...' : 'Revogar'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs text-destructive hover:text-destructive"
          disabled={busy || user.is_current_user || !canManage}
          onClick={onDelete}
        >
          {busy ? <Spinner size="sm" /> : <Trash2 className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  )
}

export default function SettingsUsersPage() {
  const freshSettingsUsersCache = settingsUsersCache && settingsUsersCache.expiresAt > Date.now() ? settingsUsersCache : null
  const [loading, setLoading] = useState(!freshSettingsUsersCache)
  const [saving, setSaving] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentUser, setCurrentUser] = useState<CurrentUserProfile | null>(freshSettingsUsersCache?.currentUser ?? null)
  const [users, setUsers] = useState<ManagedUser[]>(freshSettingsUsersCache?.users ?? [])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>('create')
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)
  const [form, setForm] = useState<UserFormState>(initialFormState)
  const [tenants, setTenants] = useState<TenantListItem[]>(freshSettingsUsersCache?.tenants ?? [])
  const [tenantsLoadError, setTenantsLoadError] = useState('')
  const [regioes, setRegioes] = useState<RegiaoItem[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState('')
  const submitGuardRef = useRef(createButtonGuard('settings-users-submit'))
  const actionGuardsRef = useRef(new Map<string, ReturnType<typeof createButtonGuard>>())

  const summary = useMemo(() => {
    const admins = users.filter((u) => isAdminUiRole(u.role)).length
    const operators = users.filter((u) => !isAdminUiRole(u.role)).length
    const active = users.filter((u) => u.is_active).length
    return { admins, operators, active }
  }, [users])

  async function loadData(force = false) {
    const cached = settingsUsersCache && settingsUsersCache.expiresAt > Date.now() ? settingsUsersCache : null
    if (!force && cached) {
      setCurrentUser(cached.currentUser)
      setUsers(cached.users)
      setTenants(cached.tenants)
      setTenantsLoadError('')
      setError('')
      setLoading(false)
      return
    }

    if (!users.length) {
      setLoading(true)
    }
    setError('')

    try {
      const me = await fetchCurrentUserProfile()
      if (!me) throw new Error('Perfil do usuário não pôde ser carregado.')
      setCurrentUser(me)

      if (isFullAdminProfile(me) || isAdminUiRole(me.role)) {
        const managedUsers = await fetchManagedUsers()
        let tenantList: TenantListItem[] = []
        let tenantError = ''

        if (isFullAdminProfile(me)) {
          try {
            tenantList = await fetchAllTenants()
          } catch (tenantLoadError) {
            console.error('[SettingsUsers] tenants load error:', tenantLoadError)
            tenantError = 'Não foi possível carregar a lista completa de empresas agora.'
          }
        } else if (me.tenant_id) {
          const ownTenantName = managedUsers.find((user) => user.tenant_id === me.tenant_id)?.tenant_name
          tenantList = [{ id: me.tenant_id, name: ownTenantName || me.tenant_id }]
        }

        if (isFullAdminProfile(me) && tenantList.length === 0) {
          const fallbackTenants = new Map<string, string>()
          for (const user of managedUsers) {
            if (user.tenant_id) fallbackTenants.set(user.tenant_id, user.tenant_name || user.tenant_id)
          }
          tenantList = Array.from(fallbackTenants, ([id, name]) => ({ id, name }))
        }

        setUsers(managedUsers)
        setTenants(tenantList)
        setTenantsLoadError(tenantError)
        settingsUsersCache = {
          expiresAt: Date.now() + SETTINGS_USERS_CACHE_TTL_MS,
          currentUser: me,
          users: managedUsers,
          tenants: tenantList,
        }
      } else {
        settingsUsersCache = {
          expiresAt: Date.now() + SETTINGS_USERS_CACHE_TTL_MS,
          currentUser: me,
          users: [],
          tenants: [],
        }
        setTenantsLoadError('')
      }
    } catch (loadError) {
      console.error('[SettingsUsers] loadData error:', loadError)
      setError(friendlyError(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  async function loadRegioes(tenantId: string) {
    if (!tenantId) { setRegioes([]); return }
    try {
      const list = await fetchRegioes(isFullAdmin ? tenantId : undefined)
      setRegioes(list)
    } catch {
      setRegioes([])
    }
  }

  function openCreateDialog() {
    setDialogMode('create')
    setEditingUser(null)
    const defaultTenantId = isFullAdmin ? (tenantOptions.length === 1 ? tenantOptions[0].id : '') : currentUser?.tenant_id ?? ''
    setForm({ ...initialFormState, tenantId: defaultTenantId })
    void loadRegioes(defaultTenantId)
    setShowPassword(false)
    setCopyFeedback('')
    setDialogOpen(true)
  }

  function openEditDialog(user: ManagedUser) {
    setDialogMode('edit')
    setEditingUser(user)
    const editTenantId = user.tenant_id ?? ''
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.is_full_admin ? 'full_admin' : isAdminUiRole(user.role) ? 'admin' : 'operator',
      isActive: user.is_active,
      tenantId: editTenantId,
      regiaoId: user.regiao_id ?? '',
    })
    void loadRegioes(editTenantId)
    setShowPassword(false)
    setCopyFeedback('')
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingUser(null)
    setForm(initialFormState)
    setShowPassword(false)
    setCopyFeedback('')
  }

  function handleGeneratePassword() {
    const password = generatePassword()
    setForm((prev) => ({ ...prev, password }))
    setShowPassword(true)
    setCopyFeedback('')
  }

  async function handleCopyPassword() {
    if (!form.password) return

    try {
      await navigator.clipboard.writeText(form.password)
      setCopyFeedback('Senha copiada.')
      setTimeout(() => setCopyFeedback(''), 2500)
    } catch {
      setCopyFeedback('Não foi possível copiar agora.')
      setTimeout(() => setCopyFeedback(''), 2500)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (dialogMode === 'edit' && form.password && form.password.length < 8) {
      setError('A nova senha precisa ter no mínimo 8 caracteres.')
      return
    }
    if (saving || !submitGuardRef.current.canExecute()) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      if (dialogMode === 'create') {
        const payload: CreateManagedUserInput = {
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim() || undefined,
          role: form.role,
          tenantId: form.tenantId || undefined,
          regiaoId: form.regiaoId || undefined,
        }
        await createManagedUser(payload)
        setSuccess('Usuário criado com sucesso.')
      } else if (editingUser) {
        await updateManagedUser(editingUser.id, {
          name: form.name.trim() || undefined,
          password: form.password || undefined,
          role: form.role,
          isActive: form.isActive,
          tenantId: form.tenantId || undefined,
          regiaoId: form.regiaoId || null,
        })
        setSuccess('Usuário atualizado com sucesso.')
      }

      closeDialog()
      await loadData(true)
    } catch (submitError) {
      setError(friendlyError(submitError))
    } finally {
      setSaving(false)
      submitGuardRef.current.reset()
    }
  }

  async function handleDisconnect(user: ManagedUser) {
    const buttonId = `settings-users-disconnect:${user.id}`
    const guard = actionGuardsRef.current.get(buttonId) ?? createButtonGuard(buttonId, { userId: currentUser?.id })
    actionGuardsRef.current.set(buttonId, guard)
    if (busyUserId || !guard.canExecute()) return

    setBusyUserId(user.id)
    setError('')
    setSuccess('')

    try {
      await disconnectManagedUser(user.id)
      setSuccess(`Sessão revogada para ${user.email}.`)
      await loadData(true)
    } catch (actionError) {
      setError(friendlyError(actionError))
    } finally {
      setBusyUserId(null)
      guard.reset()
    }
  }

  async function handleDelete(user: ManagedUser) {
    if (!window.confirm(`Excluir o usuário ${user.email}? Esta ação não pode ser desfeita.`)) return
    const buttonId = `settings-users-delete:${user.id}`
    const guard = actionGuardsRef.current.get(buttonId) ?? createButtonGuard(buttonId, { userId: currentUser?.id })
    actionGuardsRef.current.set(buttonId, guard)
    if (busyUserId || !guard.canExecute()) return

    setBusyUserId(user.id)
    setError('')
    setSuccess('')

    try {
      await deleteManagedUser(user.id)
      setSuccess(`Usuário ${user.email} excluído com sucesso.`)
      await loadData(true)
    } catch (actionError) {
      setError(friendlyError(actionError))
    } finally {
      setBusyUserId(null)
      guard.reset()
    }
  }

  const isAdmin = Boolean(currentUser && (isFullAdminProfile(currentUser) || isAdminUiRole(currentUser.role)))
  const isFullAdmin = Boolean(currentUser && isFullAdminProfile(currentUser))
  const tenantOptions = useMemo(() => {
    const ownTenant = currentUser?.tenant_id
      ? {
          id: currentUser.tenant_id,
          name: users.find((user) => user.tenant_id === currentUser.tenant_id)?.tenant_name || currentUser.tenant_id,
        }
      : null
    const baseOptions = isFullAdmin ? tenants : ownTenant ? [ownTenant] : []
    if (!form.tenantId || baseOptions.some((tenant) => tenant.id === form.tenantId)) {
      return baseOptions
    }

    const fallbackName = editingUser ? tenantLabel(editingUser, tenants) : form.tenantId
    return [...baseOptions, { id: form.tenantId, name: fallbackName }]
  }, [currentUser?.tenant_id, editingUser, form.tenantId, isFullAdmin, tenants, users])

  return (
    <ProtectedRoute allowRoles={['admin']}>
      <Layout>
        <div className="page-stack">
          <PageHeader
            icon={UserCog}
            title="Usuários"
            subtitle="Administre administradores e operadores da empresa com segurança e rastreabilidade."
            actions={isAdmin ? (
              <Button onClick={openCreateDialog} size="sm">
                <UserPlus className="h-3.5 w-3.5" />
                Novo usuário
              </Button>
            ) : null}
          />

          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : (
            <>
              {error && <AlertBanner variant="error" message={error} />}
              {success && <AlertBanner variant="success" message={success} />}

              {!isAdmin ? (
                <AlertBanner
                  variant="warning"
                  message="Seu usuário não possui permissão administrativa para gerenciar acessos."
                />
              ) : (
                <>
                  {/* KPI cards */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard label="Administradores" value={summary.admins} icon={Shield} />
                    <StatCard label="Operadores" value={summary.operators} icon={Users} />
                    <StatCard
                      label="Ativos"
                      value={summary.active}
                      icon={KeyRound}
                      iconColor="text-[hsl(var(--success))]"
                      iconBg="bg-[hsl(var(--success)/0.1)]"
                    />
                  </div>

                  {/* Desktop table */}
                  <Card className="hidden md:block overflow-hidden">
                    <CardHeader className="border-b border-[hsl(var(--border))]">
                      <CardTitle>{isFullAdmin ? 'Todos os usuários' : 'Equipe da empresa'}</CardTitle>
                      <CardDescription>
                        Crie acessos, ajuste papéis, revogue sessões e mantenha o escopo operacional separado da administração.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[hsl(var(--border))] text-left">
                              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Usuário</th>
                              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Empresa</th>
                              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Papel</th>
                              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Último login</th>
                              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Revogação</th>
                              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[hsl(var(--border))]">
                            {users.map((user) => {
                              const rowBusy = busyUserId === user.id
                              const canManageUser = isFullAdmin || !user.is_full_admin
                              const initial = (user.name?.trim()?.[0] || 'U').toUpperCase()
                              return (
                                <tr key={user.id} className="transition-colors hover:bg-[hsl(var(--muted)/0.4)]">
                                  <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-3">
                                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                                        {initial}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-5 py-3.5 text-xs text-muted-foreground">
                                    {tenantLabel(user, tenants)}
                                  </td>
                                  <td className="px-5 py-3.5">
                                    <span className="badge-status badge-status--role">{roleLabel(user)}</span>
                                  </td>
                                  <td className="px-5 py-3.5">
                                    <span className={user.is_active ? 'badge-status badge-status--active' : 'badge-status badge-status--inactive'}>
                                      {user.is_active ? 'Ativo' : 'Inativo'}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(user.last_sign_in_at)}</td>
                                  <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(user.session_revoked_at)}</td>
                                  <td className="px-5 py-3.5 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button variant="outline" size="sm" disabled={!canManageUser} onClick={() => openEditDialog(user)}>
                                        <Edit3 className="h-3 w-3" />
                                        Editar
                                      </Button>
                                      <Button variant="outline" size="sm" disabled={rowBusy || !canManageUser} onClick={() => void handleDisconnect(user)}>
                                        {rowBusy ? <Spinner size="sm" /> : <LogOut className="h-3 w-3" />}
                                        {rowBusy ? 'Aguarde...' : 'Revogar'}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive hover:text-destructive"
                                        disabled={rowBusy || user.is_current_user || !canManageUser}
                                        onClick={() => void handleDelete(user)}
                                      >
                                        {rowBusy ? <Spinner size="sm" /> : <Trash2 className="h-3 w-3" />}
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                            {users.length === 0 && (
                              <tr>
                                <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                                  Nenhum usuário encontrado.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Mobile cards */}
                  <div className="grid gap-3 md:hidden">
                    {users.length === 0 && (
                      <p className="py-8 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
                    )}
                    {users.map((user) => (
                      <UserCard
                        key={user.id}
                        user={user}
                        busy={busyUserId === user.id}
                        onEdit={() => openEditDialog(user)}
                        onDisconnect={() => void handleDisconnect(user)}
                        onDelete={() => void handleDelete(user)}
                        tenants={tenants}
                        canManage={isFullAdmin || !user.is_full_admin}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeDialog()
              return
            }
            setDialogOpen(true)
          }}
        >
          <DialogContent className="border-[hsl(var(--border))] bg-[hsl(var(--background))]">
            <DialogHeader>
              <DialogTitle>{dialogMode === 'create' ? 'Novo usuário' : 'Editar usuário'}</DialogTitle>
              <DialogDescription>
                {dialogMode === 'create'
                  ? 'Crie um acesso novo e defina o papel inicial do usuário.'
                  : 'Atualize nome, papel, status e senha quando necessário.'}
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-4 px-5 py-4 sm:px-6 sm:py-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="user-name">Nome</Label>
                <Input
                  id="user-name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do colaborador"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-email">E-mail</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={form.email}
                  disabled={dialogMode === 'edit'}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="colaborador@empresa.com"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="user-role">Papel</Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) => setForm((prev) => ({ ...prev, role: v as ManagedUserRole }))}
                  >
                    <SelectTrigger id="user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isFullAdmin && <SelectItem value="full_admin">Full Administrador</SelectItem>}
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="operator">Operador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-status">Status</Label>
                  <Select
                    value={form.isActive ? 'active' : 'inactive'}
                    onValueChange={(v) => setForm((prev) => ({ ...prev, isActive: v === 'active' }))}
                    disabled={dialogMode === 'create'}
                  >
                    <SelectTrigger id="user-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-tenant">Empresa</Label>
                <Select
                  value={form.tenantId}
                  onValueChange={(v) => {
                    setForm((prev) => ({ ...prev, tenantId: v, regiaoId: '' }))
                    void loadRegioes(v)
                  }}
                  disabled={!isFullAdmin}
                >
                  <SelectTrigger id="user-tenant">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantOptions.filter((tenant) => tenant.id).map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tenantsLoadError && <p className="text-xs text-amber-500">{tenantsLoadError}</p>}
                {tenantOptions.length === 0 && <p className="text-xs text-destructive">Nenhuma empresa disponível para seleção.</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-regiao">Região</Label>
                <Select
                  value={form.regiaoId}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, regiaoId: v === '__none__' ? '' : v }))}
                  disabled={regioes.length === 0}
                >
                  <SelectTrigger id="user-regiao">
                    <SelectValue placeholder="Sem região" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem região</SelectItem>
                    {regioes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-password">
                  {dialogMode === 'create' ? 'Senha inicial' : 'Nova senha'}
                </Label>
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="user-password"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => {
                        setCopyFeedback('')
                        setForm((prev) => ({ ...prev, password: e.target.value }))
                      }}
                      placeholder={dialogMode === 'create' ? 'Mínimo de 8 caracteres' : 'Preencha apenas se quiser alterar'}
                    />
                    <div className="flex gap-2 sm:w-auto">
                      <Button type="button" variant="outline" onClick={handleGeneratePassword}>
                        Gerar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowPassword((prev) => !prev)}
                        disabled={!form.password}
                      >
                        {showPassword ? 'Ocultar' : 'Ver'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleCopyPassword()}
                        disabled={!form.password}
                      >
                        Copiar
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dialogMode === 'create'
                      ? 'Use uma senha forte com pelo menos 8 caracteres.'
                      : 'Deixe em branco para manter a senha atual.'}
                  </p>
                  {copyFeedback && <p className="text-xs text-primary">{copyFeedback}</p>}
                </div>
              </div>

              <DialogFooter className="px-0 pb-0">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    saving
                    || !form.email.trim()
                    || !form.tenantId
                    || (dialogMode === 'create' && form.password.length < 8)
                    || (dialogMode === 'edit' && form.password.length > 0 && form.password.length < 8)
                  }
                >
                  {saving ? <Spinner size="sm" /> : null}
                  {dialogMode === 'create' ? 'Criar usuário' : 'Salvar alterações'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </Layout>
    </ProtectedRoute>
  )
}
