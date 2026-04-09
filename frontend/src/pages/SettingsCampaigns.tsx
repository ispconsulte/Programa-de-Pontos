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
  fetchActiveCampaignRuleSettings,
  getCurrentTenantId,
  saveCampaignRuleSettings,
  type CampaignRuleSettings,
} from '@/lib/supabase-queries'
import { ArrowLeft, Megaphone, Save, Zap } from 'lucide-react'

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
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [settings, setSettings] = useState<CampaignRuleSettings | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const currentTenantId = await getCurrentTenantId()
        if (!currentTenantId) { setError('Usuário sem tenant associado.'); return }

        setTenantId(currentTenantId)
        const loaded = await fetchActiveCampaignRuleSettings(currentTenantId)
        setSettings(loaded)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar configurações da campanha.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const updateField = <K extends keyof CampaignRuleSettings>(key: K, value: CampaignRuleSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const threshold = Math.max(0, Number(settings?.thresholdEarlyDays ?? 0))
  const nearDueMax = Math.max(0, threshold - 1)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!settings || !tenantId) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await saveCampaignRuleSettings(tenantId, settings)
      const refreshed = await fetchActiveCampaignRuleSettings(tenantId)
      setSettings(refreshed)
      setSuccess('Regras da campanha salvas com sucesso.')
      setTimeout(() => setSuccess(''), 3500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar as regras da campanha.')
    } finally {
      setSaving(false)
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
                    <div>
                      <h2 className="text-base font-bold text-foreground">Como os pontos são calculados</h2>
                      <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                        O sistema compara a data de pagamento com a data de vencimento e aplica as faixas abaixo automaticamente durante cada sincronização.
                      </p>
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
                <Button type="submit" disabled={saving} size="lg" className="w-full gap-2 sm:w-auto sm:min-w-[220px]">
                  {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Salvando...' : 'Salvar regras'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
