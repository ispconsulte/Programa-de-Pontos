# Relatório Técnico - Erros de Auth/Persistência Supabase

Data: 2026-03-24  
Projeto: ProgramaDePontos  
Escopo: Signup, Login, Sessão, Rotas Protegidas e Persistência (Supabase)

## 1) Erros encontrados (histórico)

### Erro 1 - Login com mensagem de indisponibilidade de banco
- Sintoma: tela de login exibindo `Database temporarily unavailable. Please try again in a few moments.`
- Endpoint afetado: `POST /auth/login` (e também `POST /auth/register`, `GET/PUT /settings`)
- Status HTTP observado: `503 Service Unavailable`
- Causa raiz: backend dependia de conexão PostgreSQL direta via pooler (`aws-1-sa-east-1.pooler.supabase.com`) que estava retornando `FATAL: Circuit breaker open: Unable to establish connection to upstream database (SQLSTATE XX000)`.

### Erro 2 - Auth local legado mascarando fluxo real do Supabase
- Sintoma: frontend armazenando tokens em `localStorage` e validando autenticação localmente.
- Impacto: comportamento inconsistente e risco de falso positivo de sessão.
- Causa raiz: fluxo anterior misturava autenticação própria com tentativa de integração Supabase.

### Erro 3 - Backend sem carregamento de variáveis em runtime
- Sintoma inicial: `Supabase auth is not configured on server`.
- Causa raiz: processo Node do backend não carregava `.env` automaticamente em runtime.

### Erro 4 - Frontend sem cliente oficial Supabase para sessão persistente
- Sintoma: controle de sessão, refresh e logout não centralizados no Supabase.
- Causa raiz: ausência de `@supabase/supabase-js` no frontend.

## 2) Correções aplicadas

### Correção A - Fonte de verdade de auth migrada para Supabase
- Signup/login/refresh/logout passaram a usar Supabase Auth real.
- Frontend passou a usar `@supabase/supabase-js` com persistência de sessão.

### Correção B - Remoção da dependência crítica do pooler Postgres nas rotas de auth/settings
- Persistência do backend para `users`, `tenants` e `audit_logs` foi migrada para cliente Supabase Admin (Service Role).
- Resultado: mesmo com instabilidade do pooler SQL externo, fluxo de auth e escrita principal do app permanece funcional via API do Supabase.

### Correção C - Middleware de rota protegida validando token Supabase
- `authenticate` agora valida Bearer token com `auth/v1/user` e resolve `userId/tenantId` por tabela `users` no Supabase.

### Correção D - Env/config padronizados
- Backend:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Frontend:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Correção E - Bootstrap idempotente de tenant
- Endpoint `/auth/register` virou bootstrap de usuário autenticado no banco da aplicação (idempotente).

## 3) Estado atual (após correções)

Fluxos validados com sucesso:
- `POST /auth/register` -> `200 OK`
- `POST /auth/login` -> `200 OK`
- `POST /auth/refresh` -> `200 OK`
- `DELETE /auth/logout` -> `204 No Content`
- `GET /settings` autenticado -> `200 OK`
- `PUT /settings` (escrita real) -> `204 No Content`
- `GET /settings` após escrita -> `200 OK` com `ixc_configured: true`

Usuário de validação funcional:
- Email: `e2e.fix.1774388422@gmail.com`
- Senha: `senha12345`

Usuário que falhava no print também validado:
- Email: `e2e.supabase.1774387642@gmail.com`
- Senha: `senha12345`
- Resultado após correção: `POST /auth/login` -> `200 OK`

## 4) Erros atuais conhecidos

No momento, não há erro bloqueante no fluxo principal de auth/persistência validado.

Observações operacionais:
- Se o pooler SQL do Supabase ficar indisponível novamente, o fluxo principal corrigido permanece funcional porque as rotas críticas agora usam Supabase Admin API (não conexão SQL pooler direta).
- `SUPABASE_SERVICE_ROLE_KEY` é obrigatório no backend para persistência/admin.

## 5) Como corrigir rapidamente se voltar a falhar

### Caso A - Erro `Supabase service role is not configured on server`
1. Verificar `.env` backend com:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Reiniciar backend.

### Caso B - Erro 401 no login
1. Confirmar credenciais no Supabase Auth.
2. Verificar se `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão corretos no frontend.
3. Limpar sessão local e tentar novamente.

### Caso C - Erro em `/settings` após login
1. Confirmar bootstrap executado (`POST /auth/register` com Bearer válido).
2. Verificar se usuário existe em `users` e possui `tenant_id` associado.

### Caso D - Ambiente local inconsistente
1. Rebuild backend: `npm run build`
2. Rebuild frontend: `cd frontend && npm run build`
3. Subir backend e frontend novamente.

## 6) Segurança e boas práticas

- Não commitar `.env` real.
- Não expor `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- Manter `SUPABASE_SERVICE_ROLE_KEY` apenas no backend.
- Rotacionar chaves se houver suspeita de exposição.

## 7) Resumo executivo

O problema principal não era a senha dos usuários testados. O gargalo era a camada de persistência no backend dependente de pooler SQL instável. A correção migrou os pontos críticos para Supabase Admin API, consolidou auth real via Supabase e removeu dependências locais/fallbacks de sessão. O fluxo end-to-end foi revalidado com sucesso.
