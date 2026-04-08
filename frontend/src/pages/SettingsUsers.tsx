import { FormEvent, useEffect, useMemo, useState } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import AlertBanner from '@/components/AlertBanner'
import Spinner from '@/components/Spinner'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
import { KeyRound, LogOut, Shield, Trash2, UserCog, UserPlus, Users } from 'lucide-react'

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
    const admins = users.filter((user) => isAdminUiRole(user.role)).length
    const operators = users.filter((user) => !isAdminUiRole(user.role)).length
    const active = users.filter((user) => user.is_active).length
    return { admins, operators, active }
  }, [users])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [me, managedUsers] = await Promise.all([
        fetchCurrentUserProfile(),
        fetchManagedUsers(),
      ])

      setCurrentUser(me)
      setUsers(managedUsers)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os usuários.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

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
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar o usuário.')
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
      setError(actionError instanceof Error ? actionError.message : 'Não foi possível desconectar o usuário.')
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleDelete(user: ManagedUser) {
    if (!window.confirm(`Excluir o usuário ${user.email}? Esta ação não pode ser desfeita.`)) {
      return
    }

    setBusyUserId(user.id)
    setError('')
    setSuccess('')

    try {
      await deleteManagedUser(user.id)
      setSuccess(`Usuário ${user.email} excluído com sucesso.`)
      await loadData()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Não foi possível excluir o usuário.')
    } finally {
      setBusyUserId(null)
    }
  }

  const isAdmin = isAdminUiRole(currentUser?.role)

  return (
    <ProtectedRoute>
      <Layout>
        <PageHeader
          icon={UserCog}
          title="Usuários"
          subtitle="Administre administradores e operadores do tenant com segurança e rastreabilidade."
          actions={isAdmin ? (
            <Button onClick={openCreateDialog}>
              <UserPlus className="h-4 w-4" />
              Novo usuário
            </Button>
          ) : null}
        />

        <div className="space-y-6">
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
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Shield className="h-4 w-4 text-primary" />
                          Administradores
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-semibold text-foreground">{summary.admins}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Usuários com poder de gestão total do tenant.</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Users className="h-4 w-4 text-primary" />
                          Operadores
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-semibold text-foreground">{summary.operators}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Usuários para operação diária sem acesso de governança.</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <KeyRound className="h-4 w-4 text-primary" />
                          Ativos
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-semibold text-foreground">{summary.active}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Contas liberadas para autenticação e uso do painel.</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Equipe do tenant</CardTitle>
                      <CardDescription>
                        Crie acessos, ajuste papéis, revogue sessões e retire usuários da operação quando necessário.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Usuário</TableHead>
                            <TableHead>Papel</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Último login</TableHead>
                            <TableHead>Revogação</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((user) => {
                            const rowBusy = busyUserId === user.id
                            return (
                              <TableRow key={user.id}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium text-foreground">{user.name}</p>
                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                                    {roleLabel(user.role)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={user.is_active
                                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                      : 'border-amber-500/20 bg-amber-500/10 text-amber-300'}
                                  >
                                    {user.is_active ? 'Ativo' : 'Inativo'}
                                  </Badge>
                                </TableCell>
                                <TableCell>{formatDateTime(user.last_sign_in_at)}</TableCell>
                                <TableCell>{formatDateTime(user.session_revoked_at)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                                      Editar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={rowBusy}
                                      onClick={() => void handleDisconnect(user)}
                                    >
                                      <LogOut className="h-3.5 w-3.5" />
                                      Desconectar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={rowBusy || user.is_current_user}
                                      onClick={() => void handleDelete(user)}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Excluir
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="border-[hsl(var(--border))] bg-[linear-gradient(180deg,rgba(16,185,129,0.06),rgba(255,255,255,0)_20%),hsl(var(--background))]">
            <DialogHeader>
              <DialogTitle>{dialogMode === 'create' ? 'Novo usuário' : 'Editar usuário'}</DialogTitle>
              <DialogDescription>
                {dialogMode === 'create'
                  ? 'Crie um acesso novo e defina o papel inicial do usuário.'
                  : 'Atualize nome, papel, status e senha quando necessário.'}
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="user-name">Nome</Label>
                <Input
                  id="user-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
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
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="colaborador@empresa.com"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="user-role">Papel</Label>
                  <select
                    id="user-role"
                    value={form.role}
                    onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as 'admin' | 'operator' }))}
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
                    onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.value === 'active' }))}
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
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder={dialogMode === 'create' ? 'Mínimo de 8 caracteres' : 'Preencha apenas se quiser alterar'}
                />
              </div>

              <DialogFooter>
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
