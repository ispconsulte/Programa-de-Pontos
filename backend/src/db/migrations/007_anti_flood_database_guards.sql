SET statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS request_locks (
  lock_key VARCHAR(255) PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE request_locks IS 'Locks leves de 30s para deduplicar escritas críticas e evitar loops concorrentes.';

CREATE INDEX IF NOT EXISTS request_locks_expires_at_idx
  ON request_locks (expires_at);
COMMENT ON INDEX request_locks_expires_at_idx IS 'Permite limpar locks expirados antes de novas operações críticas.';

CREATE TABLE IF NOT EXISTS flood_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  ip_address VARCHAR(45),
  endpoint VARCHAR(500),
  attempts INTEGER NOT NULL,
  first_attempt_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  action_taken VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE flood_audit_log IS 'Auditoria de requisições bloqueadas por proteções anti-flood.';

CREATE INDEX IF NOT EXISTS flood_audit_log_created_at_idx
  ON flood_audit_log (created_at DESC);
COMMENT ON INDEX flood_audit_log_created_at_idx IS 'Acelera relatório das tentativas bloqueadas nas últimas 24h.';

CREATE INDEX IF NOT EXISTS flood_audit_log_actor_idx
  ON flood_audit_log (user_id, ip_address, created_at DESC);
COMMENT ON INDEX flood_audit_log_actor_idx IS 'Acelera agrupamento por usuário/IP em investigações de flood.';

CREATE INDEX IF NOT EXISTS users_tenant_created_at_idx
  ON users (tenant_id, created_at ASC);
COMMENT ON INDEX users_tenant_created_at_idx IS 'Suporta listagem de usuários por tenant ordenada por criação.';

CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_at_idx
  ON audit_logs (tenant_id, created_at DESC);
COMMENT ON INDEX audit_logs_tenant_created_at_idx IS 'Suporta auditorias por tenant ordenadas por data.';

CREATE INDEX IF NOT EXISTS ixc_connections_tenant_active_created_at_idx
  ON ixc_connections (tenant_id, active DESC, created_at ASC);
COMMENT ON INDEX ixc_connections_tenant_active_created_at_idx IS 'Suporta seleção/listagem de conexões IXC ativas por tenant.';

CREATE INDEX IF NOT EXISTS campaign_events_tenant_customer_created_at_idx
  ON campaign_events (tenant_id, customer_id, created_at DESC);
COMMENT ON INDEX campaign_events_tenant_customer_created_at_idx IS 'Suporta ledger e listagem de eventos por cliente.';

CREATE INDEX IF NOT EXISTS campaign_events_tenant_profile_type_idx
  ON campaign_events (tenant_id, customer_profile_id, event_type);
COMMENT ON INDEX campaign_events_tenant_profile_type_idx IS 'Suporta resumo mensal e progresso de missões por perfil/tipo.';

CREATE INDEX IF NOT EXISTS campaign_events_tenant_occurred_at_idx
  ON campaign_events (tenant_id, occurred_at DESC);
COMMENT ON INDEX campaign_events_tenant_occurred_at_idx IS 'Suporta filtros por período e ordenações temporais de eventos.';

CREATE INDEX IF NOT EXISTS reward_redemptions_tenant_customer_created_at_idx
  ON reward_redemptions (tenant_id, customer_id, created_at DESC);
COMMENT ON INDEX reward_redemptions_tenant_customer_created_at_idx IS 'Suporta ledger e listagem de resgates por cliente.';

CREATE INDEX IF NOT EXISTS reward_redemptions_tenant_profile_created_at_idx
  ON reward_redemptions (tenant_id, customer_profile_id, created_at DESC);
COMMENT ON INDEX reward_redemptions_tenant_profile_created_at_idx IS 'Suporta consulta do último resgate e listagem por perfil.';

CREATE OR REPLACE VIEW flood_audit_top_24h AS
SELECT
  COALESCE(user_id, 'anônimo') AS user_id,
  COALESCE(ip_address, 'desconhecido') AS ip_address,
  COUNT(*)::int AS blocked_events,
  COALESCE(SUM(attempts), 0)::int AS blocked_attempts,
  MAX(last_attempt_at) AS last_attempt_at
FROM flood_audit_log
WHERE created_at >= now() - interval '24 hours'
GROUP BY COALESCE(user_id, 'anônimo'), COALESCE(ip_address, 'desconhecido')
ORDER BY blocked_attempts DESC, blocked_events DESC
LIMIT 10;

COMMENT ON VIEW flood_audit_top_24h IS 'Top 10 usuários/IPs com mais tentativas bloqueadas nas últimas 24h.';
