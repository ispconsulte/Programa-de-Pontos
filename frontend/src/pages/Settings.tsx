import { useState, useEffect, FormEvent } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import AlertBanner from '@/components/AlertBanner'
import { apiFetch, getApiErrorMessage, getDisplayError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Plug, Save, Settings, Wifi, WifiOff } from 'lucide-react'
import Spinner from '@/components/Spinner'

interface TenantSettings {
  name: string
  ixc_base_url: string | null
  ixc_user: string | null
  ixc_configured: boolean
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [ixcBaseUrl, setIxcBaseUrl] = useState('')
  const [ixcUser, setIxcUser] = useState('')
  const [ixcToken, setIxcToken] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await apiFetch('/settings')
        if (!res.ok) {
          setError(await getApiErrorMessage(res, 'Não foi possível carregar as configurações.'))
          return
        }

        const data: TenantSettings = await res.json()
        setSettings(data)
        setTenantName(data.name ?? '')
        setIxcBaseUrl(data.ixc_base_url ?? '')
        setIxcUser(data.ixc_user ?? '')
      } catch (err) {
        setError(getDisplayError(err, 'Não foi possível carregar as configurações.'))
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
      const body: Record<string, string> = { ixcBaseUrl, ixcUser, ixcToken }
      if (tenantName.trim()) body.tenantName = tenantName

      const res = await apiFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        setError(await getApiErrorMessage(res, 'Erro ao salvar configurações.'))
        return
      }

      setSuccess(true)
      setIxcToken('')
      setSettings((prev) => prev ? { ...prev, ixc_configured: true, ixc_base_url: ixcBaseUrl, ixc_user: ixcUser } : prev)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setError(getDisplayError(err, 'Erro ao salvar configurações.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProtectedRoute>
      <Layout>
        <PageHeader
          icon={Settings}
          title="Ajustes"
          subtitle="Configurações e integrações"
        />

        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">Integrações</p>
                <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-4 transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Plug className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">IXCSoft</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {settings?.ixc_configured ? (
                          <>
                            <Wifi className="h-3 w-3 text-emerald-400" />
                            <span className="text-[11px] text-emerald-400">Conectado</span>
                          </>
                        ) : (
                          <>
                            <WifiOff className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">Não configurado</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle>Base ativa</CardTitle>
                        <CardDescription className="mt-1">
                          Selecione a base IXC que será utilizada nas operações.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {settings?.ixc_configured ? (
                            <Wifi className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <WifiOff className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-white">
                              {tenantName || 'Base principal'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {settings?.ixc_configured ? settings.ixc_base_url : 'Não configurada'}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          Ativa
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Bases adicionais poderão ser cadastradas e alternadas pelo administrador.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        {settings?.ixc_configured ? (
                          <Wifi className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <CardTitle>Integração IXCSoft</CardTitle>
                        <CardDescription className="mt-1">
                          {settings?.ixc_configured
                            ? `Conectado a ${settings.ixc_base_url}`
                            : 'Preencha os dados para ativar a integração.'}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-5">
                      {error && <AlertBanner variant="error" message={error} />}
                      {success && <AlertBanner variant="success" message="Configurações salvas com sucesso." />}

                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="tenantName" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Nome da empresa</Label>
                          <Input id="tenantName" value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Minha Telecom Ltda." />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="ixcUser" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Usuário IXC</Label>
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
                        <Label htmlFor="ixcBaseUrl" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">URL base do IXC</Label>
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
                        <Label htmlFor="ixcToken" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Token IXC
                          {settings?.ixc_configured && (
                            <span className="ml-1.5 normal-case tracking-normal text-muted-foreground/60">(opcional)</span>
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

                      <div className="flex justify-end border-t border-white/[0.04] pt-5">
                        <Button
                          type="submit"
                          disabled={saving}
                          size="lg"
                          className="min-w-[200px] text-[13px] font-semibold tracking-wide"
                        >
                          {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
                          {saving ? 'Salvando...' : 'Salvar configurações'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
