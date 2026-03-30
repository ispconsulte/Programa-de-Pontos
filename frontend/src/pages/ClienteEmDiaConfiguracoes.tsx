import { useMemo, useState } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import EmptyState from '@/components/EmptyState'
import { useClienteEmDia } from '@/hooks/useClienteEmDia'
import { supabase } from '@/lib/supabase-client'
import { Clock3, RefreshCw, Settings, ShieldCheck, Wifi } from 'lucide-react'

const logStyles: Record<string, string> = {
  sucesso: 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200',
  parcial: 'border-amber-500/20 bg-amber-500/[0.06] text-amber-200',
  erro: 'border-red-500/20 bg-red-500/[0.06] text-red-200',
  processando: 'border-sky-500/20 bg-sky-500/[0.06] text-sky-200',
  pendente: 'border-white/[0.08] bg-white/[0.03] text-slate-200',
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10)
}

export default function ClienteEmDiaConfiguracoesPage() {
  const { loading, error, settings, reload } = useClienteEmDia()
  const defaultDateRange = useMemo(() => {
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() - 2)
    return {
      from: formatDateInput(start),
      to: formatDateInput(today),
    }
  }, [])
  const [dateFrom, setDateFrom] = useState(defaultDateRange.from)
  const [dateTo, setDateTo] = useState(defaultDateRange.to)
  const [syncing, setSyncing] = useState(false)
  const [syncCooldown, setSyncCooldown] = useState(false)
  const syncDisabled = syncing || syncCooldown
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'success' | 'error'
    message: string
    details?: string
  } | null>(null)
  const scoreRules = [
    { trigger: 'Pagamento ate 3 dias antes do vencimento', points: '5 pontos' },
    { trigger: 'Pagamento no dia do vencimento', points: '4 pontos' },
    { trigger: 'Pagamento apos o vencimento', points: '2 pontos' },
    { trigger: 'Upgrade de plano', points: '5 pontos' },
    { trigger: 'Contratacao de SVA', points: '3 pontos' },
    { trigger: 'Fidelizacao / renovacao', points: '3 pontos' },
  ]

  const ixcFields = [
    'Pontuacao acumulada',
    'Pontuacao mensal',
    'Status campanha (Ativo / Suspenso / Bloqueado)',
    'Ultimo resgate (data)',
  ]

  async function handleSyncNow() {
    setSyncing(true)
    setSyncFeedback(null)

    try {
      const activeConnectionId = settings?.activeIxcConnection?.id

      const { data: contractsData, error: contractsError } = await supabase.functions.invoke('sync-ixc-contratos', {
        body: {
          pageSize: 25,
          maxPages: 1,
          maxCustomers: 25,
          ixcConnectionId: activeConnectionId,
        },
      })

      if (contractsError) throw contractsError

      const { data: paymentsData, error: paymentsError } = await supabase.functions.invoke('sync-ixc-pagamentos', {
        body: {
          dateFrom,
          dateTo,
          pageSize: 25,
          maxPages: 2,
          ixcConnectionId: activeConnectionId,
        },
      })

      if (paymentsError) throw paymentsError

      await reload()

      const contractsSummary = `${Number(contractsData?.customersFetched ?? 0)} clientes e ${Number(contractsData?.contractsFetched ?? 0)} contratos`
      const paymentsSummary = `${Number(paymentsData?.processed ?? 0)} faturas processadas e ${Number(paymentsData?.pointsGranted ?? 0)} pontos`

      setSyncFeedback({
        type: 'success',
        message: 'Sincronização manual concluída com janela curta para validação inicial.',
        details: `${contractsSummary}. ${paymentsSummary}.`,
      })
    } catch (syncError) {
      setSyncFeedback({
        type: 'error',
        message: 'Não foi possível concluir a sincronização manual agora.',
        details: syncError instanceof Error ? syncError.message : String(syncError),
      })
    } finally {
      setSyncing(false)
      // Cooldown to prevent spam
      setSyncCooldown(true)
      setTimeout(() => setSyncCooldown(false), 3000)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          icon={Settings}
          title="Configurações da Campanha"
          subtitle="Ajuste calendário, conexão IXC e rotinas de sincronização do módulo Cliente em Dia em uma única visão administrativa."
          actions={
            <Button onClick={handleSyncNow} disabled={syncDisabled} className="bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-70">
              <RefreshCw className={`h-3.5 w-3.5 transition-transform ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando…' : 'Sync now'}
            </Button>
          }
        />

        <Card className="overflow-hidden border-emerald-500/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(8,10,15,0)_46%),hsl(var(--surface-1))]">
          <CardContent className="p-5 lg:p-6">
            <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/[0.08] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200">
                  Campaign settings
                </div>
                <h2 className="mt-4 text-2xl font-bold tracking-tight text-white lg:text-[30px]">
                  Experiência premium para governar calendário e sincronização
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Mantenha a campanha alinhada com a janela operacional, confirme a conexão IXC e acompanhe o histórico das últimas sincronizações.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Campanha ativa', value: settings?.activeIxcConnection ? 'Sim' : 'Nao', icon: ShieldCheck },
                  { label: 'Ultimo sync', value: settings?.latestSync?.iniciadoEm ? new Date(settings.latestSync.iniciadoEm).toLocaleString('pt-BR') : 'Sem registro', icon: RefreshCw },
                  { label: 'Intervalo atual', value: '12h', icon: Clock3 },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="rounded-2xl border border-white/[0.06] bg-black/10 px-4 py-4 backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
                        <Icon className="h-4 w-4 text-emerald-300" />
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Calendário da campanha</CardTitle>
                <CardDescription>
                  Defina o período oficial de vigência para regras, pontuação e acompanhamento da operação.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="campaign-start" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      Campaign start date
                    </Label>
                    <Input id="campaign-start" type="date" defaultValue="2026-03-01" className="[color-scheme:dark]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campaign-end" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      Campaign end date
                    </Label>
                    <Input id="campaign-end" type="date" defaultValue="2027-01-31" className="[color-scheme:dark]" />
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-sm text-muted-foreground">
                  Vigencia oficial prevista: marco/2026 a janeiro/2027, com fechamento final e expiracao dos pontos em janeiro/2027.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                    <Wifi className="h-4 w-4 text-emerald-300" />
                  </div>
                  <div>
                    <CardTitle>IXC API URL / token area</CardTitle>
                    <CardDescription>
                      Área operacional para referência da conexão responsável pelas sincronizações da campanha.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ixc-api-url" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    IXC API URL
                  </Label>
                  <Input id="ixc-api-url" value={settings?.activeIxcConnection?.ixcBaseUrl ?? ''} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ixc-api-token" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Token
                  </Label>
                  <Input id="ixc-api-token" type="password" value={settings?.activeIxcConnection ? 'Configurado no ambiente remoto' : ''} readOnly />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sincronização</CardTitle>
                <CardDescription>
                  Controle o ritmo de atualização entre o IXC e a campanha para equilibrar velocidade e estabilidade.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sync-date-from" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Janela inicial de teste
                  </Label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input id="sync-date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="[color-scheme:dark]" />
                    <Input id="sync-date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="[color-scheme:dark]" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A execução manual usa uma janela curta para validar a precisão antes de ampliar o período.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sync-interval" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Sync interval
                  </Label>
                  <select
                    id="sync-interval"
                    defaultValue="30"
                    className="h-10 w-full rounded-lg border border-white/[0.08] bg-background px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  >
                    <option value="15">15 minutos</option>
                    <option value="30">30 minutos</option>
                    <option value="60">60 minutos</option>
                    <option value="180">180 minutos</option>
                  </select>
                </div>

                {syncFeedback && (
                  <div
                    className={
                      syncFeedback.type === 'success'
                        ? 'rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-100'
                        : 'rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-100'
                    }
                  >
                    <p className="font-medium">{syncFeedback.message}</p>
                    {syncFeedback.details && (
                      <p className="mt-1 text-xs leading-relaxed text-current/80">{syncFeedback.details}</p>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={handleSyncNow} disabled={syncing} className="bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-70">
                    <RefreshCw className="h-3.5 w-3.5" />
                    {syncing ? 'Sincronizando...' : 'Sync now'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Regras oficiais de pontuacao</CardTitle>
                <CardDescription>
                  Referencia operacional das regras de comportamento e relacionamento comercial previstas no processo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {scoreRules.map((rule) => (
                  <div key={rule.trigger} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <span className="text-sm text-white">{rule.trigger}</span>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                      {rule.points}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Campos obrigatorios no IXC</CardTitle>
                <CardDescription>
                  Estrutura sugerida para espelhar o controle da campanha diretamente no cadastro do cliente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {ixcFields.map((field) => (
                  <div key={field} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white">
                    {field}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Latest synchronization logs</CardTitle>
                <CardDescription>
                  Últimos eventos registrados para facilitar leitura rápida de saúde operacional e troubleshooting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <EmptyState title="Carregando sincronizacao" description="Consultando o ultimo log no Supabase." />
                ) : error ? (
                  <EmptyState title="Falha ao carregar dados" description={error} />
                ) : settings?.latestSync ? (
                  <div
                    className={`rounded-xl border px-4 py-4 ${logStyles[settings.latestSync.status] ?? logStyles.pendente}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{settings.latestSync.tipoSync}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {settings.latestSync.mensagem ?? 'Sincronizacao registrada sem mensagem adicional.'}
                        </p>
                      </div>
                      <span className="text-[11px] font-medium uppercase tracking-[0.14em]">
                        {new Date(settings.latestSync.iniciadoEm).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <EmptyState title="Ainda nao ha registros aqui" description="Nenhum log de sincronizacao foi encontrado no Supabase." />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  )
}
