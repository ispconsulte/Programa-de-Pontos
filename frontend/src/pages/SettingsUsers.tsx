import { FormEvent, useEffect, useMemo, useState } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import AlertBanner from '@/components/AlertBanner'
import Spinner from '@/components/Spinner'
import StatCard from '@/components/StatCard'
import { Badge } from '@/components/ui/badge'
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
  createManagedUser,
  deleteManagedUser,
  disconnectManagedUser,
  fetchCurrentUserProfile,
  fetchManagedUsers,
  isAdminUiRole,
  updateManagedUser,
  type CreateManagedUserInput,
  type CurrentUserProfile,
  type ManagedUser,
} from '@/lib/user-management'
import { Edit3, KeyRound, LogOut, Shield, Trash2, UserCog, UserPlus, Users } from 'lucide-react'
import { friendlyError } from '@/lib/friendly-errors'

type DialogMode = 'create' | 'edit'

interface UserFormState {
  name: string
  email: string
  password: string
  role: 'admin' | 'operator'
  isActive: boolean
}

const initialFormState: UserFormState = {
  name: '',
  email: '',
  password: '',
  role: 'operator',
  isActive: true,
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Nunca'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Nunca'
  return parsed.toLocaleString('pt-BR')
}

function roleLabel(role: string): string {
  return isAdminUiRole(role) ? 'Administrador' : 'Operador'
}

/* ── Compact user card for mobile ── */
function UserCard({
  user,
  busy,
  onEdit,
  onDisconnect,
  onDelete,
}: {
  user: ManagedUser
  busy: boolean
  onEdit: () => void
  onDisconnect: () => void
  onDelete: () => void
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
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-[10px]">
              {roleLabel(user.role)}
            </Badge>
            <Badge
              variant="outline"
              className={user.is_active
                ? 'border-emerald-500/20 bg-emerald-500/10 text-[hsl(var(--success))] text-[10px]'
                : 'border-amber-500/20 bg-amber-500/10 text-[hsl(var(--warning))] text-[10px]'}
            >
              {user.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
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
        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={onEdit}>
          <Edit3 className="h-3 w-3" />
          Editar
        </Button>
        <Button variant="outline" size="sm" className="flex-1 text-xs" disabled={busy} onClick={onDisconnect}>
          <LogOut className="h-3 w-3" />
          Revogar
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs text-destructive hover:text-destructive"
          disabled={busy || user.is_current_user}
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

export default function SettingsUsersPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentUser, setCurrentUser] = useState<CurrentUserProfile | null>(null)
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>('create')
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)
  const [form, setForm] = useState<UserFormState>(initialFormState)

  const summary = useMemo(() => {
    const admins = users.filter((u) => isAdminUiRole(u.role)).length
    const operators = users.filter((u) => !isAdminUiRole(u.role)).length
    const active = users.filter((u) => u.is_active).length
    return { admins, operators, active }
  }, [users])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const me = await fetchCurrentUserProfile()
      if (!me) throw new Error('Perfil do usuário não pôde ser carregado.')
      setCurrentUser(me)

      if (isAdminUiRole(me.role)) {
        const managedUsers = await fetchManagedUsers()
        console.log('[SettingsUsers] managedUsers loaded:', managedUsers.length)
        setUsers(managedUsers)
      }
    } catch (loadError) {
      console.error('[SettingsUsers] loadData error:', loadError)
      setError(friendlyError(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  function openCreateDialog() {
    setDialogMode('create')
    setEditingUser(null)
    setForm(initialFormState)
    setDialogOpen(true)
  }

  function openEditDialog(user: ManagedUser) {
    setDialogMode('edit')
    setEditingUser(user)
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: isAdminUiRole(user.role) ? 'admin' : 'operator',
      isActive: user.is_active,
    })
    setDialogOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
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
        }
        await createManagedUser(payload)
        setSuccess('Usuário criado com sucesso.')
      } else if (editingUser) {
        await updateManagedUser(editingUser.id, {
          name: form.name.trim() || undefined,
          password: form.password || undefined,
          role: form.role,
          isActive: form.isActive,
        })
        setSuccess('Usuário atualizado com sucesso.')
      }

      setDialogOpen(false)
      setForm(initialFormState)
      await loadData()
    } catch (submitError) {
      setError(friendlyError(submitError))
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect(user: ManagedUser) {
    setBusyUserId(user.id)
    setError('')
    setSuccess('')

    try {
      await disconnectManagedUser(user.id)
      setSuccess(`Sessão revogada para ${user.email}.`)
      await loadData()
    } catch (actionError) {
      setError(friendlyError(actionError))
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleDelete(user: ManagedUser) {
    if (!window.confirm(`Excluir o usuário ${user.email}? Esta ação não pode ser desfeita.`)) return

    setBusyUserId(user.id)
    setError('')
    setSuccess('')

    try {
      await deleteManagedUser(user.id)
      setSuccess(`Usuário ${user.email} excluído com sucesso.`)
      await loadData()
    } catch (actionError) {
      setError(friendlyError(actionError))
    } finally {
      setBusyUserId(null)
    }
  }

  const isAdmin = Boolean(currentUser && isAdminUiRole(currentUser.role))

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
                      <CardTitle>Equipe da empresa</CardTitle>
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
                                  <td className="px-5 py-3.5">
                                    <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                                      {roleLabel(user.role)}
                                    </Badge>
                                  </td>
                                  <td className="px-5 py-3.5">
                                    <Badge
                                      variant="outline"
                                      className={user.is_active
                                        ? 'border-emerald-500/20 bg-emerald-500/10 text-[hsl(var(--success))]'
                                        : 'border-amber-500/20 bg-amber-500/10 text-[hsl(var(--warning))]'}
                                    >
                                      {user.is_active ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                  </td>
                                  <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(user.last_sign_in_at)}</td>
                                  <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(user.session_revoked_at)}</td>
                                  <td className="px-5 py-3.5 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                                        <Edit3 className="h-3 w-3" />
                                        Editar
                                      </Button>
                                      <Button variant="outline" size="sm" disabled={rowBusy} onClick={() => void handleDisconnect(user)}>
                                        <LogOut className="h-3 w-3" />
                                        Revogar
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive hover:text-destructive"
                                        disabled={rowBusy || user.is_current_user}
                                        onClick={() => void handleDelete(user)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                            {users.length === 0 && (
                              <tr>
                                <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">
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
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                  <select
                    id="user-role"
                    value={form.role}
                    onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as 'admin' | 'operator' }))}
                    className="h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-background px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/40"
                  >
                    <option value="admin">Administrador</option>
                    <option value="operator">Operador</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-status">Status</Label>
                  <select
                    id="user-status"
                    value={form.isActive ? 'active' : 'inactive'}
                    disabled={dialogMode === 'create'}
                    onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === 'active' }))}
                    className="h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-background px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/40"
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-password">
                  {dialogMode === 'create' ? 'Senha inicial' : 'Nova senha'}
                </Label>
                <Input
                  id="user-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder={dialogMode === 'create' ? 'Mínimo de 8 caracteres' : 'Preencha apenas se quiser alterar'}
                />
              </div>

              <DialogFooter className="px-0 pb-0">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !form.email.trim() || (dialogMode === 'create' && form.password.length < 8)}
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
