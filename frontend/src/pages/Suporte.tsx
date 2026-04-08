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
  Eye,
  MousePointerClick,
  ListChecks,
  Star,
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
  description: string
  steps: { title: string; text: string }[]
  tips?: string[]
}

const sections: GuideSection[] = [
  {
    id: 'painel',
    title: 'Painel',
    icon: Home,
    color: 'text-primary',
    description:
      'O Painel é a sua tela principal ao abrir o sistema. Aqui você consegue buscar qualquer cliente rapidamente, ver os pontos dele e acompanhar um resumo geral do programa.',
    steps: [
      {
        title: 'Buscar um cliente',
        text: 'Use o campo de busca no topo da tela. Você pode digitar o nome, CPF ou código do cliente. As sugestões aparecem automaticamente conforme você digita.',
      },
      {
        title: 'Ver informações do cliente',
        text: 'Ao selecionar um cliente, você verá os dados dele: nome, telefone, e-mail, plano atual, pontos acumulados e pontos disponíveis para resgate.',
      },
      {
        title: 'Consultar faturas pagas',
        text: 'Logo abaixo das informações do cliente, aparecem as últimas faturas processadas, mostrando a data de pagamento e os pontos que cada uma gerou.',
      },
      {
        title: 'Ranking de clientes',
        text: 'Na parte inferior da tela, você encontra um ranking dos clientes com mais pontos no programa. Use essa informação para identificar os clientes mais engajados.',
      },
    ],
    tips: [
      'Você pode resgatar prêmios diretamente pelo Painel, clicando no botão "Resgatar" que aparece quando o cliente tem pontos disponíveis.',
      'O ranking mostra apenas clientes ativos no programa de fidelidade.',
    ],
  },
  {
    id: 'pontuacao',
    title: 'Pontuação',
    icon: Coins,
    color: 'text-emerald-400',
    description:
      'A tela de Pontuação mostra todas as faturas que foram processadas pelo sistema e quantos pontos cada pagamento gerou. É aqui que você acompanha o desempenho de pagamento dos clientes.',
    steps: [
      {
        title: 'Entender os pontos',
        text: 'Cada fatura paga gera pontos automaticamente. Pagamento antecipado (3+ dias antes): 5 pontos. No dia do vencimento: 4 pontos. Após o vencimento: 2 pontos.',
      },
      {
        title: 'Usar os filtros',
        text: 'Você pode filtrar por situação (processado, ignorado, erro), data e buscar por nome ou CPF. Depois de ajustar os filtros, clique em "Aplicar" para ver os resultados.',
      },
      {
        title: 'Ler os cards de resumo',
        text: 'No topo da tela, os 4 cards mostram: total de clientes, quantos pagaram antecipado, quantos pagaram no dia e quantos pagaram após o vencimento.',
      },
      {
        title: 'Ver detalhes de uma fatura',
        text: 'Clique em "Ver" ao lado de qualquer registro para visualizar os detalhes completos daquela fatura, incluindo valores e datas.',
      },
    ],
    tips: [
      'Os pontos são calculados automaticamente pelo sistema com base na data de pagamento versus a data de vencimento.',
      'Faturas com status "ignorado" geralmente são duplicatas ou registros sem pagamento confirmado.',
    ],
  },
  {
    id: 'resgate',
    title: 'Resgates',
    icon: Gift,
    color: 'text-amber-400',
    description:
      'Na tela de Resgates, você registra a entrega de prêmios aos clientes que acumularam pontos suficientes. Esse é o momento mais importante do programa: a recompensa!',
    steps: [
      {
        title: '1. Acesse a tela de Resgates',
        text: 'Clique em "Resgates" no menu lateral. Você verá a lista de todos os resgates já realizados.',
      },
      {
        title: '2. Clique em "Novo resgate"',
        text: 'No canto superior direito, clique no botão "Novo resgate". Uma janela vai se abrir para você preencher os dados.',
      },
      {
        title: '3. Busque o cliente',
        text: 'Digite o nome ou CPF do cliente no campo de busca. O sistema vai mostrar sugestões com o nome e a quantidade de pontos disponíveis de cada um.',
      },
      {
        title: '4. Verifique os pontos',
        text: 'Antes de continuar, confira se o cliente tem pontos suficientes para o brinde escolhido. O sistema mostra os pontos disponíveis ao lado do nome.',
      },
      {
        title: '5. Escolha o brinde',
        text: 'Selecione o brinde na lista. Cada brinde mostra quantos pontos são necessários. Se o cliente não tiver pontos suficientes, o sistema vai avisar.',
      },
      {
        title: '6. Preencha o responsável',
        text: 'Informe o nome de quem está fazendo a entrega. Esse campo é obrigatório para manter o controle.',
      },
      {
        title: '7. Confirme o resgate',
        text: 'Clique em "Confirmar resgate". Os pontos serão descontados automaticamente do saldo do cliente. Pronto!',
      },
    ],
    tips: [
      'Você também pode fazer um resgate diretamente pelo Painel: busque o cliente, e se ele tiver pontos, o botão "Resgatar" aparece automaticamente.',
      'Depois de registrar um resgate, o saldo do cliente é atualizado na hora. Não é preciso atualizar manualmente.',
      'Se o cliente não aparece na busca, pode ser que ele ainda não tenha sido sincronizado com o programa. Verifique na tela de Pontuação.',
    ],
  },
  {
    id: 'catalogo',
    title: 'Catálogo',
    icon: ShoppingBag,
    color: 'text-sky-400',
    description:
      'O Catálogo é onde você gerencia os brindes e prêmios disponíveis para resgate. Aqui você cadastra, edita e controla o estoque dos itens que os clientes podem trocar por pontos.',
    steps: [
      {
        title: 'Ver os brindes disponíveis',
        text: 'Ao abrir a tela, você verá todos os brindes cadastrados em formato de cards, com nome, pontos necessários e estoque disponível.',
      },
      {
        title: 'Adicionar um novo brinde',
        text: 'Clique em "Novo brinde" para cadastrar um novo item. Preencha o nome, a quantidade de pontos necessários, uma descrição e, opcionalmente, uma imagem.',
      },
      {
        title: 'Editar ou desativar um brinde',
        text: 'Cada brinde tem opções para editar as informações ou desativá-lo temporariamente. Brindes desativados não aparecem na hora do resgate.',
      },
      {
        title: 'Controlar o estoque',
        text: 'O campo de estoque permite que você saiba quantas unidades ainda estão disponíveis de cada brinde. Atualize sempre que houver novas entregas.',
      },
    ],
    tips: [
      'Mantenha o catálogo atualizado para evitar que clientes tentem resgatar brindes que não estão mais disponíveis.',
      'Use nomes claros e descrições curtas para facilitar a identificação dos brindes na hora do resgate.',
    ],
  },
]

/* ─── FAQ ─── */
const faqs = [
  {
    q: 'Como sei se um cliente tem pontos para resgatar?',
    a: 'Busque o cliente no Painel. Os pontos disponíveis aparecem em destaque. Se ele tiver pontos suficientes para algum brinde, o botão "Resgatar" aparece automaticamente.',
  },
  {
    q: 'O que acontece se o cliente não tiver pontos suficientes?',
    a: 'O sistema avisa com uma mensagem de "Saldo insuficiente" e não permite continuar o resgate. O cliente precisa acumular mais pontos.',
  },
  {
    q: 'Os pontos expiram?',
    a: 'Sim. Os pontos do programa atual expiram em janeiro de 2027. Incentive os clientes a resgatarem antes dessa data.',
  },
  {
    q: 'Como o cliente ganha mais pontos?',
    a: 'Pagando as faturas em dia ou antecipado. Quanto mais cedo pagar, mais pontos recebe: 5 pontos para antecipado, 4 no dia e 2 após o vencimento.',
  },
  {
    q: 'Posso desfazer um resgate?',
    a: 'Resgates registrados não podem ser desfeitos pelo sistema. Em caso de erro, entre em contato com o administrador para um ajuste manual.',
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
          subtitle="Aprenda a usar cada parte do sistema de forma simples e rápida"
        />

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setActiveSection(null) }}
              placeholder="Buscar no guia..."
              className="w-full rounded-xl border border-border bg-surface-1 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
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
                    className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:bg-primary/[0.03]"
                  >
                    <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/50', section.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground">{section.title}</h3>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">{section.description}</p>
                      <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                        {section.steps.length} passos · {section.tips?.length ?? 0} dicas
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {filteredSections.length === 0 && (
              <div className="py-12 text-center">
                <Search className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-3 text-sm text-muted-foreground">Nenhum resultado encontrado para "{searchQuery}"</p>
              </div>
            )}

            {/* FAQ */}
            <div className="mt-8">
              <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                Perguntas Frequentes
              </h2>
              <div className="space-y-2">
                {faqs.map((faq, i) => (
                  <details key={i} className="group rounded-xl border border-border bg-card">
                    <summary className="flex cursor-pointer items-center gap-3 px-5 py-3.5 text-sm font-medium text-foreground list-none [&::-webkit-details-marker]:hidden">
                      <HelpCircle className="h-4 w-4 shrink-0 text-primary" />
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

            <div className="flex items-center gap-3 mb-6">
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/50', currentSection.color)}>
                <currentSection.icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">{currentSection.title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{currentSection.description}</p>
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              {currentSection.steps.map((step, i) => (
                <div key={i} className="flex gap-4 rounded-xl border border-border bg-card p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
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
                  Dicas úteis
                </h3>
                <ul className="space-y-2">
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
