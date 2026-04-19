import { useState, useEffect, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import AlertBanner from '@/components/AlertBanner'
import { friendlyError } from '@/lib/friendly-errors'
import { fetchTenantSettings, getCurrentTenantId, saveTenantSettings, type TenantSettings } from '@/lib/supabase-queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Briefcase, Building2, Megaphone, Save, UserCog, Wifi, WifiOff } from 'lucide-react'
import Spinner from '@/components/Spinner'

const SETTINGS_CACHE_TTL_MS = 60_000
let settingsCache: { expiresAt: number; settings: TenantSettings | null } | null = null

/* ── Quick-link card ── */
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

export default function SettingsPage() {
  const freshSettingsCache = settingsCache && settingsCache.expiresAt > Date.now() ? settingsCache : null
  const [settings, setSettings] = useState<TenantSettings | null>(freshSettingsCache?.settings ?? null)
  const [loading, setLoading] = useState(!freshSettingsCache)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [ixcBaseUrl, setIxcBaseUrl] = useState('')
  const [ixcUser, setIxcUser] = useState('')
  const [ixcToken, setIxcToken] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchSettings = async (force = false) => {
      const cached = settingsCache && settingsCache.expiresAt > Date.now() ? settingsCache : null
      if (!force && cached) {
        setSettings(cached.settings)
        setTenantName(cached.settings?.name ?? '')
        setIxcBaseUrl(cached.settings?.ixcConnection?.ixc_base_url ?? '')
        setIxcUser(cached.settings?.ixcConnection?.ixc_user ?? '')
        setError('')
        setLoading(false)
        return
      }

      if (!settings) {
        setLoading(true)
      }
      setError('')
      try {
        const tenantId = await getCurrentTenantId()
        if (!tenantId) { setError('Usuário não associado a um tenant.'); return }

        const data = await fetchTenantSettings(tenantId)
        if (!data) { setError('Configurações não encontradas.'); return }

        setSettings(data)
        setTenantName(data.name ?? '')
        setIxcBaseUrl(data.ixcConnection?.ixc_base_url ?? '')
        setIxcUser(data.ixcConnection?.ixc_user ?? '')
        settingsCache = {
          expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS,
          settings: data,
        }
      } catch (err) {
        setError(friendlyError(err))
      } finally {
        setLoading(false)
      }
    }
    void fetchSettings()
  }, [])

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (!ixcBaseUrl.trim()) nextErrors.ixcBaseUrl = 'URL base é obrigatória.'
    if (!ixcUser.trim()) nextErrors.ixcUser = 'Usuário IXC é obrigatório.'
    if (!ixcToken.trim() && !settings?.ixc_configured) nextErrors.ixcToken = 'Token é obrigatório.'
    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!validate()) return

    setSaving(true)
    try {
      const tenantId = await getCurrentTenantId()
      if (!tenantId) { setError('Usuário não associado a um tenant.'); return }

      await saveTenantSettings(tenantId, {
        tenantName: tenantName.trim() || undefined,
        ixcBaseUrl,
        ixcUser,
        ixcToken: ixcToken || undefined,
        connectionId: settings?.ixcConnection?.id ?? null,
      })

      const refreshedSettings = await fetchTenantSettings(tenantId)
      setSettings(refreshedSettings)
      setTenantName(refreshedSettings?.name ?? tenantName)
      setIxcBaseUrl(refreshedSettings?.ixcConnection?.ixc_base_url ?? ixcBaseUrl)
      setIxcUser(refreshedSettings?.ixcConnection?.ixc_user ?? ixcUser)
      settingsCache = {
        expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS,
        settings: refreshedSettings,
      }
      setSuccess(true)
      setIxcToken('')
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProtectedRoute allowRoles={['admin']}>
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

              {/* Base ativa */}
              <Card className="overflow-hidden border-[hsl(var(--border))]">
                <CardHeader className="border-b border-[hsl(var(--border))]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Base ativa</CardTitle>
                      <CardDescription>Conexão IXC utilizada nas operações atuais.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      {settings?.ixc_configured ? (
                        <Wifi className="h-4 w-4 shrink-0 text-emerald-400" />
                      ) : (
                        <WifiOff className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{tenantName || 'Base principal'}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {settings?.ixc_configured ? settings.ixcConnection?.ixc_base_url : 'Não configurada'}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                      settings?.ixc_configured
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                        : 'border-primary/20 bg-primary/10 text-primary'
                    }`}>
                      {settings?.ixc_configured ? 'Conectado' : 'Pendente'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Integração IXCSoft form */}
              <Card>
                <CardHeader className="border-b border-[hsl(var(--border))]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      {settings?.ixc_configured ? (
                        <Wifi className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <CardTitle>Integração IXCSoft</CardTitle>
                      <CardDescription>
                        {settings?.ixc_configured
                          ? `Conectado a ${settings.ixcConnection?.ixc_base_url || ixcBaseUrl || 'IXCSoft'}`
                          : 'Preencha os dados para ativar a integração.'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-8">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {error && <AlertBanner variant="error" message={error} />}
                    {success && <AlertBanner variant="success" message="Configurações salvas com sucesso." />}

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="tenantName">Nome da empresa</Label>
                        <Input id="tenantName" value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Minha Telecom Ltda." />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ixcUser">Usuário IXC</Label>
                        <Input
                          id="ixcUser"
                          value={ixcUser}
                          onChange={(e) => { setIxcUser(e.target.value); setFieldErrors((prev) => ({ ...prev, ixcUser: '' })) }}
                          placeholder="usuario_api"
                          className={fieldErrors.ixcUser ? 'border-destructive/50' : ''}
                        />
                        {fieldErrors.ixcUser && <p className="text-xs text-destructive">{fieldErrors.ixcUser}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ixcBaseUrl">URL base do IXC</Label>
                      <Input
                        id="ixcBaseUrl"
                        type="url"
                        value={ixcBaseUrl}
                        onChange={(e) => { setIxcBaseUrl(e.target.value); setFieldErrors((prev) => ({ ...prev, ixcBaseUrl: '' })) }}
                        placeholder="https://ixc.suaempresa.com.br"
                        className={fieldErrors.ixcBaseUrl ? 'border-destructive/50' : ''}
                      />
                      {fieldErrors.ixcBaseUrl && <p className="text-xs text-destructive">{fieldErrors.ixcBaseUrl}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ixcToken">
                        Token IXC
                        {settings?.ixc_configured && (
                          <span className="ml-1.5 text-muted-foreground/60">(deixe vazio para manter o atual)</span>
                        )}
                      </Label>
                      <Input
                        id="ixcToken"
                        type="password"
                        value={ixcToken}
                        onChange={(e) => { setIxcToken(e.target.value); setFieldErrors((prev) => ({ ...prev, ixcToken: '' })) }}
                        placeholder={settings?.ixc_configured ? '••••••••' : 'seu-token-ixc'}
                        className={fieldErrors.ixcToken ? 'border-destructive/50' : ''}
                      />
                      {fieldErrors.ixcToken && <p className="text-xs text-destructive">{fieldErrors.ixcToken}</p>}
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-[hsl(var(--border))] pt-5 sm:flex-row sm:justify-end">
                      <Button type="submit" disabled={saving} size="lg" className="w-full gap-2 sm:w-auto sm:min-w-[200px]">
                        {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
                        {saving ? 'Salvando...' : 'Salvar configurações'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
