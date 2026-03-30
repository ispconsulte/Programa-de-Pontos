# PRD — IXC Integration API · Fase 1

## Visão geral

MicroSaaS multi-tenant de integração com o ERP IXCSoft. Na Fase 1 o produto expõe uma API REST que permite empresas de telecomunicações consultar recebimentos reais, contratos e dados de clientes com validação correta das regras de negócio do IXC.

---

## Escopo da fase 1

**IN**
- Cadastro e autenticação de tenants
- Proxy seguro para IXC com credenciais por tenant
- Endpoint: contas a receber (fn_areceber) com validação de recebimento real
- Endpoint: contratos (cliente_contrato) com cascata de IDs
- Endpoint: clientes (busca por ID, CPF/CNPJ e nome)
- Audit log imutável por tenant

**OUT**
- UI/Dashboard front-end
- Webhooks / eventos em tempo real
- Relatórios agregados / BI

---

## Regras de negócio críticas

### Validação de recebimento real

`status = "R"` AND `valor_recebido` não vazio AND `valor_recebido != "0.00"` = Recebimento real.

Quando `valor_recebido` está vazio ou zerado com `status = "R"`, o título é **renegociado** — NÃO é entrada de caixa. O campo auxiliar `titulo_renegociado = "S"` confirma o status, mas o critério primário é sempre `valor_recebido`.

### Cascata de ID de contrato

Resolver: `id_contrato` → `id_contrato_avulso` → `id_contrato_principal`.

Se os três estiverem vazios, é cobrança avulsa sem contrato — vincular apenas ao `id_cliente`.

---

## Arquitetura

### Stack
- Node.js 20 + TypeScript (strict mode)
- Fastify com @fastify/jwt, @fastify/rate-limit, @fastify/helmet
- PostgreSQL com Row Level Security por tenant_id
- Redis para rate limit e blacklist de JWT
- Zod para validação de schemas
- Vitest + supertest para testes
- Docker Compose para desenvolvimento local

### Fluxo de dados

```
Client → [JWT Auth Middleware] → [Tenant Resolver] → [IXC Proxy Service] → IXCSoft ERP
                                        ↓
                                 [Audit Logger]
                                        ↓
                                  PostgreSQL
```

---

## Endpoints públicos (fase 1)

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
DELETE /auth/logout

GET    /receivables
GET    /receivables/:id
GET    /contracts/:id
GET    /clients
GET    /clients/:id
```

---

## Modelo de dados

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ixc_base_url TEXT NOT NULL,
  ixc_user TEXT NOT NULL,
  ixc_token_enc BYTEA NOT NULL,
  ixc_token_iv BYTEA NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID,
  action TEXT NOT NULL,
  ixc_endpoint TEXT NOT NULL,
  http_status INT,
  ip_addr INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE RULE no_update_audit AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
```

---

## Segurança

| Controle | Implementação |
|---|---|
| JWT | RS256, access 15min, refresh rotativo 7d, blacklist Redis |
| Credenciais IXC | AES-256-GCM, IV aleatório por registro, chave via env |
| SSRF | Validar ixc_base_url, bloquear IPs privados e loopback |
| Rate limit | 60 req/min por tenant_id via Redis sliding window |
| Input IXC | Whitelist de qtypes e operadores permitidos |
| Headers | HSTS, X-Frame-Options: DENY, nosniff, remover Server/X-Powered-By |
| Audit | Toda chamada ao IXC gera registro append-only |

---

## Critérios de aceite

- AC-01: Tenant A não consegue ver dados do Tenant B
- AC-02: valor_recebido vazio → categoria "renegotiated"
- AC-03: Cascata de contrato resolve corretamente
- AC-04: URL IXC com IP privado → 422
- AC-05: Toda chamada ao IXC gera audit_log
- AC-06: Token expirado → 401 genérico
- AC-07: Rate limit → 429 com Retry-After
