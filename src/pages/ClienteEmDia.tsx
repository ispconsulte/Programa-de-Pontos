import Layout from '@/components/Layout'
import { Star } from 'lucide-react'

export default function ClienteEmDiaPage() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Star className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Cliente em Dia</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe a fidelidade e o status dos seus clientes.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
          <p className="text-muted-foreground">
            Em breve: relatórios de engajamento e fidelização dos clientes.
          </p>
        </div>
      </div>
    </Layout>
  )
}
