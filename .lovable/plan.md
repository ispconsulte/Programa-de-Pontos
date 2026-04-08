
# Plano de Reestruturação Front-End

## Problemas identificados
1. **Sidebar**: Card "Empresa ativa" sobrepõe o ícone do presente, ocupa espaço excessivo (h-36)
2. **Dashboard (Operação)**: Hero com texto longo + card "Escopo da empresa" redundante + 4 botões de atalho desnecessários (já estão na sidebar)
3. **Clientes**: Formulário de busca com 2 containers aninhados `rounded-[1.75rem]` excessivamente complexo; atendente precisa de acesso rápido por CPF
4. **Resgates**: Kanban mostra apenas status genéricos sem nomes/itens; falta controle de estoque visível
5. **Excesso de botões e informação**: muitos elementos competindo visualmente

## Etapas de implementação

### Etapa 1 — Sidebar compacta (Layout.tsx)
- Reduzir logo area de `h-36` para `h-16` (expanded) / `h-14` (collapsed)
- **Remover** card "Empresa ativa" que sobrepõe o ícone
- Mover nome da empresa para o rodapé da sidebar (pequeno, discreto)
- Achatar accordion de Administração → links diretos

### Etapa 2 — Dashboard simplificado (Dashboard.tsx)
- **Remover** hero section inteiro (texto longo + 4 botões de atalho)
- **Remover** card "Escopo da empresa" (redundante)
- Manter apenas: 3 StatCards + tabela de histórico recente
- Layout mais limpo e direto

### Etapa 3 — Clientes focado no atendente (Clients.tsx)
- Simplificar busca: 1 input com tabs inline (Nome/CPF/ID) — sem containers aninhados
- Resultado mostra: nome, CPF, pontos disponíveis, status de pagamento
- Visual de card rápido para mobile (atendente na loja)

### Etapa 4 — Resgates com nomes e itens (Resgates.tsx)
- Substituir Kanban vazio por tabela/lista com: nome do cliente, item resgatado, pontos gastos, status, data
- Cada linha mostra claramente "Lourenço resgatou Mouse — 50 pts"
- Adicionar coluna de estoque restante quando disponível
- Filtros por status em tabs simples (não botões flutuantes)

### Etapa 5 — Limpeza geral
- Remover `PageHeader` subtitles longos (manter só título)
- Padronizar espaçamento e remover bordas redundantes
- Garantir que tema claro/escuro funcione em todos os componentes alterados
