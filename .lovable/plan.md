

## Diagnóstico

O campo `ixc_user` na tabela `ixc_connections` está salvo como `api_user`, mas a API do IXC espera o **ID numérico do usuário** como username. No Postman que funciona, o username é `2`.

Resultado: o header `Authorization: Basic base64(api_user:token)` falha com 401. O correto seria `Basic base64(2:token)`.

## Plano de Correção

### 1. Atualizar o `ixc_user` no banco de dados
Executar um UPDATE direto na tabela `ixc_connections` para trocar `api_user` por `2` para a conexão existente.

```sql
UPDATE ixc_connections 
SET ixc_user = '2', updated_at = now()
WHERE id = 'd6cfe53f-8608-436a-a277-b047c0e47885';
```

Também atualizar na tabela `tenants` (legacy mirror):
```sql
UPDATE tenants 
SET ixc_user = '2'
WHERE id = 'ae559ee9-40d4-47f8-b5ba-09ca3744f612';
```

### 2. Rodar a sync novamente
Após a correção, invocar `sync-ixc-pagamentos` com `{"tenantId":"ae559ee9-40d4-47f8-b5ba-09ca3744f612"}` para validar que a autenticação funciona.

### 3. (Opcional) Melhorar o formulário de configurações
Adicionar orientação no frontend (placeholder ou help text) indicando que o campo "Usuário IXC" deve ser o **ID numérico** do usuário da API, não o nome.

## Detalhes Técnicos

- O fluxo de autenticação em `sync-ixc-pagamentos` e `ixc-proxy.ts` monta: `Authorization: Basic base64(ixc_user:decrypted_token)`
- O token está correto (começa com `c1fee...`), apenas o username está errado
- Nenhuma mudança de código é necessária — apenas correção de dados

