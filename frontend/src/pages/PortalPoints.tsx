import { Sparkles } from 'lucide-react'
import logoBonifica from '@/assets/logo-bonifica.png'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import EmptyState from '@/components/EmptyState'

export default function PortalPointsPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.14),_transparent_28%),linear-gradient(180deg,#f7fbf8_0%,#eef7f0_40%,#f7faf8_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/10 ring-1 ring-emerald-600/10">
              <img src={logoBonifica} alt="Bonifica" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-700">Portal Cliente em Dia</p>
              <p className="text-sm text-slate-500">Sua campanha de pontos em um lugar simples de acompanhar.</p>
            </div>
          </div>

          <Badge className="rounded-full bg-emerald-100 px-4 py-1.5 text-emerald-800 hover:bg-emerald-100">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Campanha ativa
          </Badge>
        </div>

        <Card className="overflow-hidden border-emerald-200/70 bg-white shadow-xl shadow-emerald-950/5">
          <CardContent className="p-6 lg:p-8">
            <EmptyState
              title="Não foi possível encontrar dados no momento"
              description="Ainda não há registros aqui. Assim que seus dados forem sincronizados, seus pontos e resgates aparecerão neste portal."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
