import { useEffect, useRef, useState } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import RegisterRedemptionDialog from '@/components/RegisterRedemptionDialog'
import EmptyState from '@/components/EmptyState'
import WelcomeModal from '@/components/WelcomeModal'
import Spinner from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Sparkles, ChevronRight, Gift } from 'lucide-react'
import { fetchLegacyRedemptions, getCurrentTenantId } from '@/lib/supabase-queries'
import { useNavigate } from 'react-router-dom'
import { createButtonGuard } from '@/utils/antiFlood'

type RedemptionStatus = 'pendente' | 'entregue' | 'cancelado'

const STATUS_TABS: { value: RedemptionStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'pendente', label: 'Pendente' },
]

interface RedemptionRow {
  id: string
  ixc_cliente_id?: string
  tipo_destinatario?: 'cliente' | 'contato'
  brinde_nome: string
  pontos_utilizados: number
  status_resgate: string
  created_at: string
  cliente_nome?: string
}

const REDEMPTIONS_CACHE_TTL_MS = 60_000
let redemptionsCache: { expiresAt: number; rows: RedemptionRow[] } | null = null

function statusLabel(s: string) {
  if (s === 'pendente') return 'Pendente'
  if (s === 'em_preparo') return 'Em preparo'
  if (s === 'entregue') return 'Entregue'
  if (s === 'cancelado') return 'Cancelado'
  return s
}

function statusColor(s: string) {
  if (s === 'pendente') return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  if (s === 'em_preparo') return 'bg-violet-500/10 text-violet-400 border-violet-500/20'
  if (s === 'entregue') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  if (s === 'cancelado') return 'bg-destructive/10 text-destructive border-destructive/20'
  return 'bg-muted text-muted-foreground border-border'
}

export default function ResgatesPage() {
  const navigate = useNavigate()
  const openRedemptionGuardRef = useRef(createButtonGuard('redemptions-open-detail'))
  const [reloadKey, setReloadKey] = useState(0)
  const [tab, setTab] = useState<RedemptionStatus | 'all'>('all')
  const freshRedemptionsCache = redemptionsCache && redemptionsCache.expiresAt > Date.now() ? redemptionsCache : null
  const [rows, setRows] = useState<RedemptionRow[]>(freshRedemptionsCache?.rows ?? [])
  const [loading, setLoading] = useState(!freshRedemptionsCache)

  useEffect(() => {
    let mounted = true
    const load = async (force = false) => {
      const cached = redemptionsCache && redemptionsCache.expiresAt > Date.now() ? redemptionsCache : null
      if (!force && cached) {
        setRows(cached.rows)
        setLoading(false)
        return
      }

      if (!rows.length) {
        setLoading(true)
      }
      try {
        const tenantId = await getCurrentTenantId()
        if (!tenantId || !mounted) return

        const rawResgates = await fetchLegacyRedemptions({ limit: 100 })

        const nextRows = rawResgates.map((r: any) => ({
          id: r.id,
          ixc_cliente_id: r.ixc_cliente_id,
          tipo_destinatario: r.tipo_destinatario,
          brinde_nome: r.brinde_nome,
          pontos_utilizados: r.pontos_utilizados,
          status_resgate: r.status_resgate,
          created_at: r.created_at,
          cliente_nome: r.cliente_nome || r.destinatario_nome || (r.ixc_cliente_id ? `Cliente #${r.ixc_cliente_id}` : 'Contato'),
        }))

        setRows(nextRows)
        redemptionsCache = {
          expiresAt: Date.now() + REDEMPTIONS_CACHE_TTL_MS,
          rows: nextRows,
        }
      } catch {
        setRows([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load(reloadKey > 0)
    return () => { mounted = false }
  }, [reloadKey, rows.length])

  const filtered = tab === 'all' ? rows : rows.filter((r) => r.status_resgate === tab)
  const openRedemption = (row: RedemptionRow) => {
    if (!row.ixc_cliente_id) return
    if (!openRedemptionGuardRef.current.canExecute()) return
    navigate(`/cliente-em-dia/${row.ixc_cliente_id}`, { state: { from: '/resgates' } })
    setTimeout(() => openRedemptionGuardRef.current.reset(), 2000)
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="page-stack">
          {/* Header row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground">Resgates</h1>
              <p className="text-xs text-muted-foreground">Acompanhe os resgates dos clientes</p>
            </div>
            <RegisterRedemptionDialog
              onRedemptionComplete={() => setReloadKey(k => k + 1)}
              trigger={
                <Button size="sm" className="w-full sm:w-auto">
                  <Sparkles className="h-3.5 w-3.5" />
                  Novo resgate
                </Button>
              }
            />
          </div>

          {/* Status tabs */}
          <WelcomeModal
            storagePrefix="operator-resgates"
            message={
              <>
                Antes de registrar um resgate, confirme a disponibilidade do item no
                <strong> estoque físico</strong>. Uma verificação rápida no catálogo garante que o
                cliente saia satisfeito e evita surpresas durante o atendimento!
              </>
            }
          />

          <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={cn(
                  'shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  tab === t.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {t.label}
                {t.value !== 'all' && (
                  <span className="ml-1.5 text-[11px] opacity-80">
                    {rows.filter((r) => r.status_resgate === t.value).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="md" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Gift className="h-5 w-5" />}
              title="Nenhum resgate encontrado"
              description={tab === 'all' ? 'Ainda não há resgates registrados.' : `Nenhum resgate com status "${statusLabel(tab)}".`}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card">
              {/* Mobile list */}
              <div className="divide-y divide-border md:hidden">
                {filtered.map((row) => (
                  <div
                    key={row.id}
                    className={cn(
                      'px-4 py-3 transition-colors',
                      row.ixc_cliente_id ? 'cursor-pointer hover:bg-muted active:bg-muted/70' : '',
                    )}
                    onClick={() => openRedemption(row)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{row.cliente_nome}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          resgatou <span className="font-medium text-foreground">{row.brinde_nome}</span>
                        </p>
                      </div>
                      <div className="ml-2 flex items-center gap-1.5">
                        <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold', statusColor(row.status_resgate))}>
                          {statusLabel(row.status_resgate)}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{row.pontos_utilizados} pts</span>
                      <span>{new Date(row.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Cliente</th>
                      <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Item resgatado</th>
                      <th className="px-3 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pontos</th>
                      <th className="px-3 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Data</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((row) => (
                      <tr
                        key={row.id}
                        className={cn('transition-colors', row.ixc_cliente_id ? 'cursor-pointer hover:bg-muted' : '')}
                        onClick={() => openRedemption(row)}
                      >
                        <td className="px-5 py-3 font-medium text-foreground">{row.cliente_nome}</td>
                        <td className="px-3 py-3 text-foreground">{row.brinde_nome}</td>
                        <td className="px-3 py-3 text-center font-semibold text-muted-foreground">{row.pontos_utilizados}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold', statusColor(row.status_resgate))}>
                            {statusLabel(row.status_resgate)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{new Date(row.created_at).toLocaleDateString('pt-BR')}</td>
                        <td className="px-3 py-3 text-muted-foreground">
                          <ChevronRight className="h-4 w-4" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
