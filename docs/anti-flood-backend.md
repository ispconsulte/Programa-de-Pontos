# Anti Flood Backend

## Framework e middleware

- Backend identificado: Fastify.
- Middleware existente: `@fastify/rate-limit`.
- Redis é usado em produção quando `REDIS_URL` está configurado; em desenvolvimento/teste há fallback em memória.

## Limites configurados

| Camada | Escopo | Limite | Chave |
|---|---:|---:|---|
| Global | Todas as rotas | 100 req/min | IP |
| Busca/listagem | `GET`, `search`, `load`, `buscar`, `carregar` | 30 req/min | `userId + endpoint` ou `IP + endpoint` |
| Refresh/sync | `refresh`, `reload`, `sync`, `sincronizar` | 10 req/min | `userId + endpoint` ou `IP + endpoint` |
| Escrita | `POST`, `PUT`, `PATCH`, `DELETE` | 20 req/min | `userId + endpoint` ou `IP + endpoint` |
| Export/relatório | `export`, `report`, `relatorio` | 5 req/min | `userId + endpoint` ou `IP + endpoint` |

Ao exceder, a API responde `429` com:

```json
{
  "error": "too_many_requests",
  "message": "Muitas requisições em pouco tempo. Aguarde alguns segundos.",
  "retryAfter": 30,
  "limit": 10,
  "window": "60s"
}
```

Headers retornados: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` e `Retry-After`.

## Circuit breaker

As chamadas externas ao IXCSoft abrem circuito após 3 falhas em 30 segundos. O circuito fica aberto por 60 segundos e registra:

```text
[CIRCUIT-BREAKER] Serviço IXCSoft indisponível.
```

## Idempotência

Rotas `POST` fora de `/auth` aceitam o header opcional `Idempotency-Key`. A mesma chave, para o mesmo usuário/IP e endpoint, retorna a resposta anterior por até 24 horas sem executar a operação novamente.

## Como testar

```bash
# Global: disparar mais de 100 chamadas em 60s
for i in {1..105}; do curl -i http://localhost:3000/clients; done

# Escrita: repetir mais de 20 POSTs em 60s
for i in {1..25}; do curl -i -X POST http://localhost:3000/campaign/events -H "Content-Type: application/json" -d "{}"; done

# Idempotência: repetir o mesmo POST com a mesma chave
curl -i -X POST http://localhost:3000/campaign/events -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" -H "Content-Type: application/json" -d "{}"
curl -i -X POST http://localhost:3000/campaign/events -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" -H "Content-Type: application/json" -d "{}"
```

## Ajuste por ambiente

- `NODE_ENV=production`: usa Redis para compartilhar contadores entre instâncias.
- `REDIS_URL`: define a instância Redis usada por rate limiting e idempotência.
- Para alterar limites, ajuste os valores em `backend/src/lib/anti-flood.ts` e o limite global em `backend/src/server.ts`.
