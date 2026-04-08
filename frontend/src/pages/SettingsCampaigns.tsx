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
import { ArrowLeft, Save, Settings2, Trophy } from 'lucide-react'

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
        if (!currentTenantId) {
          setError('Usuário sem tenant associado.')
          return
        }

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
        <PageHeader
          icon={Settings2}
          title="Campanhas"
          subtitle="Defina as regras e a lógica de pontos válidas para a empresa atual."
        />

        <div className="space-y-6">
          <div>
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link to="/admin/empresa">
                <ArrowLeft className="h-4 w-4" />
                Voltar para Administração
              </Link>
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && <AlertBanner variant="error" message={error} />}
              {success && <AlertBanner variant="success" message={success} />}

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Trophy className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Campanha ativa</CardTitle>
                      <CardDescription>
                        A sincronização de pagamentos usará estas regras para calcular os pontos.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-lg border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm">
                    <p className="font-medium text-foreground">Como os pontos são calculados</p>
                    <p className="mt-1 text-muted-foreground">
                      O sistema compara a data de pagamento com a data de vencimento da fatura e aplica a faixa abaixo.
                    </p>
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

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="threshold-days">Dias antes para contar como antecipado</Label>
                      <Input
                        id="threshold-days"
                        type="number"
                        min={0}
                        value={settings?.thresholdEarlyDays ?? 3}
                        onChange={(e) => updateField('thresholdEarlyDays', Number(e.target.value || 0))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="points-early">Pontos para pagamento antecipado</Label>
                      <Input
                        id="points-early"
                        type="number"
                        min={0}
                        value={settings?.pointsEarly ?? 5}
                        onChange={(e) => updateField('pointsEarly', Number(e.target.value || 0))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="points-on-due">Pontos para pagamento próximo ao vencimento</Label>
                      <Input
                        id="points-on-due"
                        type="number"
                        min={0}
                        value={settings?.pointsOnDue ?? 4}
                        onChange={(e) => updateField('pointsOnDue', Number(e.target.value || 0))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="points-late">Pontos para pagamento em atraso</Label>
                      <Input
                        id="points-late"
                        type="number"
                        min={0}
                        value={settings?.pointsLate ?? 2}
                        onChange={(e) => updateField('pointsLate', Number(e.target.value || 0))}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
                    <p className="font-medium text-foreground">Resumo simples da regra ativa</p>
                    <div className="mt-2 space-y-1 text-muted-foreground">
                      <p>
                        1. Pagou com <strong className="text-foreground">{threshold} dias ou mais</strong> de antecedência:
                        {' '}<strong className="text-foreground">{settings?.pointsEarly ?? 0} pontos</strong>
                      </p>
                      <p>
                        2. Pagou no dia do vencimento ou até <strong className="text-foreground">{nearDueMax} dia(s)</strong> antes:
                        {' '}<strong className="text-foreground">{settings?.pointsOnDue ?? 0} pontos</strong>
                      </p>
                      <p>
                        3. Pagou depois do vencimento:
                        {' '}<strong className="text-foreground">{settings?.pointsLate ?? 0} pontos</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-border pt-5">
                    <Button type="submit" disabled={saving} className="min-w-[220px] gap-2">
                      {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
                      {saving ? 'Salvando...' : 'Salvar regras da campanha'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
