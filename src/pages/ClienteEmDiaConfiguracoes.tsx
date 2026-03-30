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
import { Clock3, RefreshCw, Settings, ShieldCheck, Wifi } from 'lucide-react'

const syncLogs: Array<{ id: string; createdAt: string; title: string; detail: string; status: string }> = []

const logStyles: Record<string, string> = {
  success: 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200',
  warning: 'border-amber-500/20 bg-amber-500/[0.06] text-amber-200',
  info: 'border-sky-500/20 bg-sky-500/[0.06] text-sky-200',
}

export default function ClienteEmDiaConfiguracoesPage() {
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

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          icon={Settings}
          title="Configurações da Campanha"
          subtitle="Ajuste calendário, conexão IXC e rotinas de sincronização do módulo Cliente em Dia em uma única visão administrativa."
          actions={
            <Button className="bg-emerald-600 text-white hover:bg-emerald-500">
              <RefreshCw className="h-3.5 w-3.5" />
              Sync now
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
                  { label: 'Campanha ativa', value: 'Sim', icon: ShieldCheck },
                  { label: 'Último sync', value: '14:10', icon: RefreshCw },
                  { label: 'Intervalo atual', value: '30 min', icon: Clock3 },
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
                  <Input id="ixc-api-url" defaultValue="https://ixc.suaempresa.com.br/webservice/v1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ixc-api-token" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Token
                  </Label>
                  <Input id="ixc-api-token" type="password" placeholder="Token configurado no ambiente" />
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

                <div className="flex justify-end">
                  <Button className="bg-emerald-600 text-white hover:bg-emerald-500">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Sync now
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
                {syncLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`rounded-xl border px-4 py-4 ${logStyles[log.status]}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{log.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{log.detail}</p>
                      </div>
                      <span className="text-[11px] font-medium uppercase tracking-[0.14em]">
                        {log.createdAt}
                      </span>
                    </div>
                  </div>
                ))}
                {syncLogs.length === 0 && (
                  <EmptyState title="Ainda nao ha registros aqui" description="Nao foi possivel encontrar dados no momento." />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  )
}
