import { useState } from 'react'
import {
  Home,
  Coins,
  Gift,
  ShoppingBag,
  ChevronRight,
  HelpCircle,
  CheckCircle2,
  Search,
  ArrowLeft,
  Sparkles,
  Star,
  Zap,
  AlertCircle,
  ThumbsUp,
} from 'lucide-react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PageHeader from '@/components/PageHeader'
import { cn } from '@/lib/utils'

/* ─── Data ─── */

interface GuideSection {
  id: string
  title: string
  icon: React.ElementType
  color: string
  gradient: string
  emoji: string
  tagline: string
  description: string
  steps: { title: string; text: string; highlight?: boolean }[]
  tips?: string[]
  warning?: string
}

const sections: GuideSection[] = [
  {
    id: 'painel',
    title: 'Painel',
    icon: Home,
    color: 'text-primary',
    gradient: 'from-primary/15 to-primary/5',
    emoji: '🏠',
    tagline: 'Sua tela inicial',
    description: 'É aqui que tudo começa. Busque um cliente, veja os pontos dele e faça resgates — tudo em um só lugar.',
    steps: [
      {
        title: 'Buscar cliente',
        text: 'Digite o nome ou CPF no campo de busca. As sugestões aparecem na hora.',
        highlight: true,
      },
      {
        title: 'Ver pontos e dados',
        text: 'Ao clicar no cliente, você vê tudo: nome, telefone, plano, pontos acumulados e disponíveis.',
      },
      {
        title: 'Faturas recentes',
        text: 'Logo abaixo, aparecem as últimas faturas pagas e quantos pontos cada uma gerou.',
      },
      {
        title: 'Resgatar direto daqui',
        text: 'Se o cliente tiver pontos, aparece um botão verde "Resgatar". Clique e pronto!',
        highlight: true,
      },
      {
        title: 'Ranking',
        text: 'Na parte de baixo, veja quem são os clientes com mais pontos no programa.',
      },
    ],
    tips: [
      'O jeito mais rápido de resgatar é pelo Painel — busca o cliente e clica em Resgatar.',
      'O ranking só mostra clientes ativos no programa.',
    ],
  },
  {
    id: 'pontuacao',
    title: 'Pontuação',
    icon: Coins,
    color: 'text-emerald-400',
    gradient: 'from-emerald-500/15 to-emerald-500/5',
    emoji: '⭐',
    tagline: 'Acompanhe os pontos',
    description: 'Veja todas as faturas processadas e quantos pontos cada pagamento gerou. Os pontos são automáticos!',
    steps: [
      {
        title: 'Como funciona a pontuação',
        text: 'Pagou antecipado (3+ dias antes)? → 5 pontos. No dia? → 4 pontos. Atrasado? → 2 pontos.',
        highlight: true,
      },
      {
        title: 'Cards no topo',
        text: 'Os 4 cards mostram: total de clientes, quantos pagaram antecipado, no dia e após o vencimento.',
      },
      {
        title: 'Filtrar e buscar',
        text: 'Use os filtros de data e situação. Depois clique em "Aplicar". Também dá pra buscar por nome ou CPF.',
      },
      {
        title: 'Ver detalhes',
        text: 'Clique em "Ver" ao lado de qualquer fatura para ver todos os detalhes: valores, datas e pontos.',
      },
    ],
    tips: [
      'Os pontos são calculados automaticamente — não precisa fazer nada.',
      'Faturas "ignoradas" são duplicatas ou sem pagamento confirmado. Não se preocupe com elas.',
    ],
    warning: 'Os pontos expiram em janeiro de 2027. Avise os clientes para resgatarem antes!',
  },
  {
    id: 'resgate',
    title: 'Resgates',
    icon: Gift,
    color: 'text-amber-400',
    gradient: 'from-amber-500/15 to-amber-500/5',
    emoji: '🎁',
    tagline: 'Entregue recompensas',
    description: 'O momento mais legal! Aqui você registra a entrega dos brindes aos clientes que acumularam pontos.',
    steps: [
      {
        title: '1. Abra "Resgates" no menu',
        text: 'Você vai ver a lista de todos os resgates já feitos.',
      },
      {
        title: '2. Clique em "Novo resgate"',
        text: 'O botão fica no canto superior direito. Uma janela vai abrir.',
        highlight: true,
      },
      {
        title: '3. Busque o cliente',
        text: 'Digite o nome ou CPF. O sistema mostra o nome e os pontos disponíveis de cada um.',
      },
      {
        title: '4. Confira os pontos',
        text: 'Olhe se o cliente tem pontos suficientes pro brinde. Se não tiver, o sistema avisa.',
        highlight: true,
      },
      {
        title: '5. Escolha o brinde',
        text: 'Selecione na lista. Cada brinde mostra quantos pontos precisa.',
      },
      {
        title: '6. Informe o responsável',
        text: 'Coloque o nome de quem está entregando. É obrigatório.',
      },
      {
        title: '7. Confirme!',
        text: 'Clique em "Confirmar resgate". Os pontos são descontados na hora. Acabou!',
        highlight: true,
      },
    ],
    tips: [
      'Atalho: busque o cliente no Painel → se tiver pontos, aparece o botão "Resgatar" direto.',
      'Depois do resgate, o saldo atualiza sozinho. Não precisa recarregar a tela.',
      'Se o cliente não aparece na busca, talvez ele ainda não foi sincronizado. Verifique na Pontuação.',
    ],
    warning: 'Resgates não podem ser desfeitos. Confira tudo antes de confirmar!',
  },
  {
    id: 'catalogo',
    title: 'Catálogo',
    icon: ShoppingBag,
    color: 'text-sky-400',
    gradient: 'from-sky-500/15 to-sky-500/5',
    emoji: '🛍️',
    tagline: 'Gerencie os brindes',
    description: 'Cadastre, edite e controle o estoque dos brindes que os clientes podem trocar por pontos.',
    steps: [
      {
        title: 'Ver brindes',
        text: 'Ao abrir, você vê todos os brindes em cards com nome, pontos e estoque.',
      },
      {
        title: 'Adicionar brinde',
        text: 'Clique em "Novo brinde". Preencha nome, pontos necessários e descrição.',
        highlight: true,
      },
      {
        title: 'Editar ou desativar',
        text: 'Cada brinde tem opção de editar ou desativar. Desativados não aparecem no resgate.',
      },
      {
        title: 'Controlar estoque',
        text: 'Atualize o estoque sempre que receber novas unidades. Assim evita frustrar os clientes.',
      },
    ],
    tips: [
      'Use nomes curtos e claros nos brindes — facilita na hora do resgate.',
      'Mantenha o catálogo atualizado. Brinde sem estoque = cliente frustrado.',
    ],
  },
]

/* ─── Quick reference card ─── */
const quickRef = [
  { emoji: '🔍', label: 'Buscar cliente', where: 'Painel' },
  { emoji: '⭐', label: 'Ver pontos', where: 'Painel ou Pontuação' },
  { emoji: '🎁', label: 'Fazer resgate', where: 'Painel ou Resgates' },
  { emoji: '🛍️', label: 'Gerenciar brindes', where: 'Catálogo' },
]

/* ─── FAQ ─── */
const faqs = [
  {
    q: '🤔 Como sei se o cliente pode resgatar?',
    a: 'Busque ele no Painel. Se tiver pontos suficientes, o botão "Resgatar" aparece automaticamente em verde.',
  },
  {
    q: '❌ E se não tiver pontos suficientes?',
    a: 'O sistema bloqueia e avisa "Saldo insuficiente". O cliente precisa pagar mais faturas para acumular pontos.',
  },
  {
    q: '⏰ Os pontos expiram?',
    a: 'Sim! Os pontos do programa atual expiram em janeiro de 2027. Incentive os clientes a resgatarem antes.',
  },
  {
    q: '📈 Como ganhar mais pontos?',
    a: 'Pagando as faturas cedo! Antecipado = 5 pts, no dia = 4 pts, atrasado = 2 pts. Quanto antes pagar, mais pontos ganha.',
  },
  {
    q: '🔄 Posso desfazer um resgate?',
    a: 'Não. Resgates são definitivos. Sempre confira os dados antes de confirmar. Em caso de erro grave, fale com o administrador.',
  },
  {
    q: '👤 O cliente não aparece na busca, e agora?',
    a: 'Ele pode ainda não ter sido sincronizado. Verifique na tela de Pontuação ou peça ao administrador para rodar a sincronização.',
  },
]

/* ─── Component ─── */
export default function SuportePage() {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const currentSection = sections.find((s) => s.id === activeSection) ?? null

  const filteredSections = searchQuery.trim()
    ? sections.filter((s) => {
        const q = searchQuery.toLowerCase()
        return (
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.steps.some((st) => st.title.toLowerCase().includes(q) || st.text.toLowerCase().includes(q))
        )
      })
    : sections

  return (
    <ProtectedRoute>
      <Layout>
        <PageHeader
          icon={HelpCircle}
          title="Central de Ajuda"
          subtitle="Guia rápido e prático — direto ao ponto"
        />


        {/* Search */}
        <div className="mb-5">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setActiveSection(null) }}
              placeholder="Buscar no guia..."
              className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
            />
          </div>
        </div>

        {!currentSection ? (
          <>
            {/* Section cards */}
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredSections.map((section) => {
                const Icon = section.icon
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className="group relative flex items-start gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                  >
                    {/* Gradient accent */}
                    <div className={cn('absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100', section.gradient)} />
                    <div className="relative">
                      <span className="text-3xl">{section.emoji}</span>
                    </div>
                    <div className="relative min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground">{section.title}</h3>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                          {section.tagline}
                        </span>
                        <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{section.description}</p>
                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-[10px] font-medium text-muted-foreground/60">
                          📋 {section.steps.length} passos
                        </span>
                        {section.tips && (
                          <span className="text-[10px] font-medium text-muted-foreground/60">
                            💡 {section.tips.length} dicas
                          </span>
                        )}
                        {section.warning && (
                          <span className="text-[10px] font-medium text-amber-400/70">
                            ⚠️ Atenção
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {filteredSections.length === 0 && (
              <div className="py-12 text-center">
                <Search className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-3 text-sm text-muted-foreground">Nenhum resultado para "{searchQuery}"</p>
              </div>
            )}

            {/* Pontuação cheat sheet */}
            <div className="mt-8 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] to-transparent p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
                <Star className="h-3.5 w-3.5" />
                Tabela de pontos — Cole na sua mesa!
              </h3>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/15 px-4 py-3">
                  <span className="text-2xl font-black text-emerald-400">5</span>
                  <div>
                    <p className="text-xs font-bold text-foreground">pts</p>
                    <p className="text-[10px] text-muted-foreground">Pagou 3+ dias antes</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-sky-500/[0.08] border border-sky-500/15 px-4 py-3">
                  <span className="text-2xl font-black text-sky-400">4</span>
                  <div>
                    <p className="text-xs font-bold text-foreground">pts</p>
                    <p className="text-[10px] text-muted-foreground">Pagou no dia</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-amber-500/[0.08] border border-amber-500/15 px-4 py-3">
                  <span className="text-2xl font-black text-amber-400">2</span>
                  <div>
                    <p className="text-xs font-bold text-foreground">pts</p>
                    <p className="text-[10px] text-muted-foreground">Pagou atrasado</p>
                  </div>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div className="mt-8">
              <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                Perguntas que todo mundo faz
              </h2>
              <div className="space-y-2">
                {faqs.map((faq, i) => (
                  <details key={i} className="group rounded-xl border border-border bg-card">
                    <summary className="flex cursor-pointer items-center gap-3 px-5 py-3.5 text-sm font-medium text-foreground list-none [&::-webkit-details-marker]:hidden">
                      <span className="flex-1">{faq.q}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="border-t border-border px-5 py-4 text-sm leading-relaxed text-muted-foreground">
                      {faq.a}
                    </div>
                  </details>
                ))}
              </div>
            </div>

            {/* Footer help */}
            <div className="mt-8 mb-4 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <ThumbsUp className="h-5 w-5 shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Ainda com dúvida?</span>{' '}
                Chame seu administrador ou entre em contato com o suporte técnico. Estamos aqui pra ajudar! 💬
              </p>
            </div>
          </>
        ) : (
          /* ─── Detail view ─── */
          <div>
            <button
              type="button"
              onClick={() => setActiveSection(null)}
              className="mb-5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao guia
            </button>

            {/* Header */}
            <div className={cn('rounded-xl border border-border bg-gradient-to-br p-5 mb-6', currentSection.gradient)}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{currentSection.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-foreground">{currentSection.title}</h2>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                      {currentSection.tagline}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{currentSection.description}</p>
                </div>
              </div>
            </div>

            {/* Warning */}
            {currentSection.warning && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <p className="text-sm text-amber-200/80 font-medium">{currentSection.warning}</p>
              </div>
            )}

            {/* Steps */}
            <div className="space-y-2.5">
              {currentSection.steps.map((step, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex gap-4 rounded-xl border p-4 transition-colors',
                    step.highlight
                      ? 'border-primary/25 bg-primary/[0.04]'
                      : 'border-border bg-card'
                  )}
                >
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                    step.highlight
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-semibold', step.highlight ? 'text-foreground' : 'text-foreground')}>
                      {step.title}
                      {step.highlight && <span className="ml-2 text-[10px] font-medium text-primary">⭐ importante</span>}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Tips */}
            {currentSection.tips && currentSection.tips.length > 0 && (
              <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
                  <Star className="h-3.5 w-3.5" />
                  Dicas pra facilitar sua vida
                </h3>
                <ul className="space-y-2.5">
                  {currentSection.tips.map((tip, i) => (
                    <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  )
}
