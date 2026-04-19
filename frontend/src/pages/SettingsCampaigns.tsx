import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import AlertBanner from '@/components/AlertBanner'
import Spinner from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createDefaultCampaignRuleSettings,
  deleteCampaignRuleSettings,
  fetchCampaignRuleSettingsList,
  fetchActiveCampaignRuleSettings,
  getCurrentTenantId,
  saveCampaignRuleSettings,
  type CampaignRuleSettings,
} from '@/lib/supabase-queries'
import { ArrowLeft, Megaphone, Plus, Save, Trash2, Zap } from 'lucide-react'
import { friendlyError } from '@/lib/friendly-errors'

const SETTINGS_CAMPAIGNS_CACHE_TTL_MS = 60_000
const settingsCampaignsCache = new Map<string, { expiresAt: number; campaigns: CampaignRuleSettings[] }>()

/* ── Points tier visual ── */
function PointsTier({ tier, label, value }: { tier: number; label: string; value: number }) {
  const colors = [
    'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400',
    'border-primary/20 bg-primary/[0.06] text-primary',
    'border-amber-500/20 bg-amber-500/[0.06] text-amber-400',
  ]
  const color = colors[(tier - 1) % colors.length]

  return (
    <div className={`flex items-center justify-between rounded-lg border px-4 py-3 ${color}`}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-current/10 text-[11px] font-bold opacity-80">{tier}</span>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <span className="text-lg font-bold">{value} pts</span>
    </div>
  )
}

export default function SettingsCampaignsPage() {
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [settings, setSettings] = useState<CampaignRuleSettings | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignRuleSettings[]>([])

  useEffect(() => {
    const load = async (force = false) => {
      if (tenantId && !force) {
        const cached = settingsCampaignsCache.get(tenantId)
        if (cached && cached.expiresAt > Date.now()) {
          setCampaigns(cached.campaigns)
          setSettings(cached.campaigns.find((campaign) => campaign.active) ?? cached.campaigns[0] ?? createDefaultCampaignRuleSettings())
          setError('')
          setLoading(false)
          return
        }
      }

      if (!campaigns.length) {
        setLoading(true)
      }
      setError('')
      try {
        const currentTenantId = await getCurrentTenantId()
        if (!currentTenantId) { setError('Usuário sem tenant associado.'); return }

        setTenantId(currentTenantId)
        const loadedCampaigns = await fetchCampaignRuleSettingsList(currentTenantId)
        settingsCampaignsCache.set(currentTenantId, {
          expiresAt: Date.now() + SETTINGS_CAMPAIGNS_CACHE_TTL_MS,
          campaigns: loadedCampaigns,
        })
        setCampaigns(loadedCampaigns)
        setSettings(loadedCampaigns.find((campaign) => campaign.active) ?? loadedCampaigns[0] ?? createDefaultCampaignRuleSettings())
      } catch (err) {
        setError(friendlyError(err))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [campaigns.length, tenantId])

  const updateField = <K extends keyof CampaignRuleSettings>(key: K, value: CampaignRuleSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const threshold = Math.max(0, Number(settings?.thresholdEarlyDays ?? 0))
  const nearDueMax = Math.max(0, threshold - 1)

  const showTemporarySuccess = (message: string) => {
    setSuccess(message)
    setTimeout(() => setSuccess(''), 3500)
  }

  const handleSelectCampaign = async (campaignId: string) => {
    if (!tenantId) return

    setError('')

    if (campaignId === '__new__') {
      setSettings(createDefaultCampaignRuleSettings())
      return
    }

    const selectedCampaign = campaigns.find((campaign) => campaign.campaignId === campaignId)
    if (selectedCampaign) {
      setSettings(selectedCampaign)
      return
    }

    const activeCampaign = await fetchActiveCampaignRuleSettings(tenantId)
    setSettings(activeCampaign)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!settings || !tenantId) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await saveCampaignRuleSettings(tenantId, settings)
      const refreshedCampaigns = await fetchCampaignRuleSettingsList(tenantId)
      settingsCampaignsCache.set(tenantId, {
        expiresAt: Date.now() + SETTINGS_CAMPAIGNS_CACHE_TTL_MS,
        campaigns: refreshedCampaigns,
      })
      setCampaigns(refreshedCampaigns)
      const refreshed = refreshedCampaigns.find((campaign) => campaign.active)
        ?? refreshedCampaigns.find((campaign) => campaign.campaignName === (settings.campaignName.trim() || 'Campanha padrão'))
        ?? refreshedCampaigns[0]
        ?? createDefaultCampaignRuleSettings()
      setSettings(refreshed)
      showTemporarySuccess('Campanha salva com sucesso.')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!tenantId || !settings?.campaignId) return

    const confirmed = window.confirm(`Excluir a campanha "${settings.campaignName}"?`)
    if (!confirmed) return

    setDeleting(true)
    setError('')
    setSuccess('')

    try {
      await deleteCampaignRuleSettings(tenantId, settings.campaignId)
      const refreshedCampaigns = await fetchCampaignRuleSettingsList(tenantId)
      settingsCampaignsCache.set(tenantId, {
        expiresAt: Date.now() + SETTINGS_CAMPAIGNS_CACHE_TTL_MS,
        campaigns: refreshedCampaigns,
      })
      setCampaigns(refreshedCampaigns)
      setSettings(refreshedCampaigns.find((campaign) => campaign.active) ?? refreshedCampaigns[0] ?? createDefaultCampaignRuleSettings())
      showTemporarySuccess('Campanha excluída com sucesso.')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ProtectedRoute allowRoles={['admin']}>
      <Layout>
        <div className="page-stack">
          <PageHeader
            icon={Megaphone}
            title="Campanhas"
            subtitle="Defina as regras e a lógica de pontos válidas para a empresa atual."
            actions={
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/empresa">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Administração
                </Link>
              </Button>
            }
          />

          {loading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && <AlertBanner variant="error" message={error} />}
              {success && <AlertBanner variant="success" message={success} />}

              {/* Hero info */}
              <Card className="overflow-hidden border-primary/10 bg-[linear-gradient(135deg,hsl(var(--primary)/0.06),transparent_50%),hsl(var(--surface-1))]">
                <CardContent className="p-5 lg:p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div className="space-y-3">
                      <h2 className="text-base font-bold text-foreground">Como os pontos são calculados</h2>
                      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        A cada fatura paga, o sistema compara automaticamente a <strong className="text-foreground">data de pagamento</strong> com a <strong className="text-foreground">data de vencimento</strong> e atribui pontos conforme as faixas configuradas abaixo. Quanto mais cedo o cliente pagar, mais pontos receberá.
                      </p>
                      <div className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        <p className="font-medium text-foreground">Para que serve esta tela?</p>
                        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px]">
                          <li>Definir quantos pontos cada comportamento de pagamento gera.</li>
                          <li>Ajustar o limiar de dias para considerar um pagamento "antecipado".</li>
                          <li>Criar promoções temporárias — ex.: <strong className="text-foreground">dobrar a pontuação</strong> em um mês específico basta duplicar os valores e salvar.</li>
                          <li>Ao salvar, as novas regras passam a valer na próxima sincronização automática.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Form card */}
              <Card>
                <CardHeader className="border-b border-[hsl(var(--border))]">
                  <CardTitle>Regras da campanha</CardTitle>
                  <CardDescription>Ajuste os parâmetros abaixo e salve para aplicar.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 pt-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="campaign-selector">Campanha</Label>
                      <select
                        id="campaign-selector"
                        value={settings?.campaignId ?? '__new__'}
                        onChange={(e) => void handleSelectCampaign(e.target.value)}
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {campaigns.map((campaign) => (
                          <option key={campaign.campaignId ?? campaign.campaignName} value={campaign.campaignId ?? ''}>
                            {campaign.campaignName}{campaign.active ? ' (ativa)' : ''}
                          </option>
                        ))}
                        <option value="__new__">Nova campanha</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 md:flex-none"
                        onClick={() => setSettings(createDefaultCampaignRuleSettings())}
                      >
                        <Plus className="h-4 w-4" />
                        Nova
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive md:flex-none"
                        onClick={() => void handleDelete()}
                        disabled={!settings?.campaignId || deleting}
                      >
                        {deleting ? <Spinner size="sm" /> : <Trash2 className="h-4 w-4" />}
                        Excluir
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="campaign-name">Nome da campanha</Label>
                    <Input
                      id="campaign-name"
                      value={settings?.campaignName ?? ''}
                      onChange={(e) => updateField('campaignName', e.target.value)}
                      placeholder="Campanha Cliente em Dia"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="threshold-days">Dias de antecedência</Label>
                      <Input
                        id="threshold-days"
                        type="number"
                        min={0}
                        value={settings?.thresholdEarlyDays ?? 3}
                        onChange={(e) => updateField('thresholdEarlyDays', Number(e.target.value || 0))}
                      />
                      <p className="text-[11px] text-muted-foreground">Dias antes do vencimento para considerar antecipado.</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="points-early">Pontos — antecipado</Label>
                      <Input
                        id="points-early"
                        type="number"
                        min={0}
                        value={settings?.pointsEarly ?? 5}
                        onChange={(e) => updateField('pointsEarly', Number(e.target.value || 0))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="points-on-due">Pontos — no vencimento</Label>
                      <Input
                        id="points-on-due"
                        type="number"
                        min={0}
                        value={settings?.pointsOnDue ?? 4}
                        onChange={(e) => updateField('pointsOnDue', Number(e.target.value || 0))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="points-late">Pontos — em atraso</Label>
                      <Input
                        id="points-late"
                        type="number"
                        min={0}
                        value={settings?.pointsLate ?? 2}
                        onChange={(e) => updateField('pointsLate', Number(e.target.value || 0))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Rule summary */}
              <Card>
                <CardHeader className="border-b border-[hsl(var(--border))]">
                  <CardTitle className="text-base">Resumo da regra</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-5">
                  <PointsTier
                    tier={1}
                    label={`Pagamento ≥ ${threshold} dias antes do vencimento`}
                    value={settings?.pointsEarly ?? 0}
                  />
                  <PointsTier
                    tier={2}
                    label={`Pagamento no dia ou até ${nearDueMax} dia(s) antes`}
                    value={settings?.pointsOnDue ?? 0}
                  />
                  <PointsTier
                    tier={3}
                    label="Pagamento após o vencimento"
                    value={settings?.pointsLate ?? 0}
                  />
                </CardContent>
              </Card>

              {/* Submit */}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                  <Link to="/admin/empresa">Cancelar</Link>
                </Button>
                <Button type="submit" disabled={saving || deleting} size="lg" className="w-full gap-2 sm:w-auto sm:min-w-[220px]">
                  {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Salvando...' : settings?.campaignId ? 'Salvar campanha' : 'Criar campanha'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
