import { useMemo, useState } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, CheckCircle2, ChevronRight, Search, Upload, UserPlus, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ClienteEmDiaCadastrarPage() {
  const [search, setSearch] = useState('')
  const [csvList, setCsvList] = useState('')

  const csvIds = useMemo(() => {
    return csvList
      .split(/[\s,;\n\r]+/)
      .map((value) => value.trim())
      .filter(Boolean)
  }, [csvList])

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/cliente-em-dia" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            Cliente em Dia
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Cadastro em lote</span>
        </div>

        <PageHeader
          icon={UserPlus}
          title="Cadastro em Lote"
          subtitle="Inclua clientes do IXC na campanha Cliente em Dia por busca filtrada ou importacao de lista com ixc_cliente_id."
          actions={
            <>
              <Button variant="outline" size="sm" className="border-emerald-500/20 bg-emerald-500/[0.08] text-[hsl(var(--success))] hover:bg-emerald-500/[0.12]">
                <Upload className="h-3.5 w-3.5" />
                Modelo CSV
              </Button>
              <Button variant="success" size="sm">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Incluir selecionados
              </Button>
            </>
          }
        />

        <Card className="overflow-hidden border-emerald-500/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(8,10,15,0)_46%),hsl(var(--surface-1))]">
          <CardContent className="p-5 lg:p-6">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Clientes visíveis', value: '0' },
                { label: 'Selecionados em lote', value: '0' },
                { label: 'IDs no CSV', value: String(csvIds.length) },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Buscar clientes IXC</CardTitle>
              <CardDescription>
                Filtre a base para localizar rapidamente quem deve entrar na campanha neste ciclo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome, IXC ID ou cidade"
                  className="h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                />
              </div>

              <EmptyState title="Ainda nao ha registros aqui" description="Nao foi possivel encontrar dados no momento." />
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Inclusão via CSV</CardTitle>
                <CardDescription>
                  Cole uma lista com `ixc_cliente_id` para processar o cadastro em lote por identificador.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-dashed border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-8 text-center">
                  <Upload className="mx-auto h-8 w-8 text-emerald-300" />
                  <p className="mt-3 text-sm font-medium text-foreground">Arraste um CSV ou use a área abaixo</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aceite uma coluna simples com lista de `ixc_cliente_id`.
                  </p>
                </div>

                <textarea
                  value={csvList}
                  onChange={(event) => setCsvList(event.target.value)}
                  placeholder="Cole uma lista de ixc_cliente_id, um por linha"
                  className="min-h-[160px] w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none transition-all duration-200 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                />

                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Prévia</p>
                  <p className="mt-2 text-sm text-foreground">{csvIds.length} IDs detectados para inclusão</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/10">
              <CardHeader>
                <CardTitle>Ação em lote</CardTitle>
                <CardDescription>
                  Revise os IDs informados e confirme a próxima etapa operacional.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                      <Users className="h-4 w-4 text-emerald-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Resumo do lote</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        0 clientes encontrados na busca e {csvIds.length} IDs informados manualmente.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button variant="success">
                    Incluir clientes na campanha
                  </Button>
                  <Button variant="outline" className="border-[hsl(var(--border))]">
                    Limpar seleção
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  )
}
