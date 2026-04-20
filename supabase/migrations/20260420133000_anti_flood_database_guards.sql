SET statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS public.request_locks (
  lock_key varchar(255) PRIMARY KEY,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_by varchar(255),
  expires_at timestamptz NOT NULL
);

COMMENT ON TABLE public.request_locks IS 'Locks leves de 30s para deduplicar escritas críticas e evitar loops concorrentes.';

CREATE INDEX IF NOT EXISTS request_locks_expires_at_idx
  ON public.request_locks (expires_at);
COMMENT ON INDEX public.request_locks_expires_at_idx IS 'Permite limpar locks expirados antes de novas operações críticas.';

CREATE TABLE IF NOT EXISTS public.flood_audit_log (
  id bigserial PRIMARY KEY,
  user_id varchar(255),
  ip_address varchar(45),
  endpoint varchar(500),
  attempts integer NOT NULL,
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  action_taken varchar(50),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.flood_audit_log IS 'Auditoria de requisições bloqueadas por proteções anti-flood.';

CREATE INDEX IF NOT EXISTS flood_audit_log_created_at_idx
  ON public.flood_audit_log (created_at DESC);
COMMENT ON INDEX public.flood_audit_log_created_at_idx IS 'Acelera relatório das tentativas bloqueadas nas últimas 24h.';

CREATE INDEX IF NOT EXISTS flood_audit_log_actor_idx
  ON public.flood_audit_log (user_id, ip_address, created_at DESC);
COMMENT ON INDEX public.flood_audit_log_actor_idx IS 'Acelera agrupamento por usuário/IP em investigações de flood.';

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS users_tenant_created_at_idx
      ON public.users (tenant_id, created_at ASC);
    COMMENT ON INDEX public.users_tenant_created_at_idx IS 'Suporta listagem de usuários por tenant ordenada por criação.';
  END IF;

  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_at_idx
      ON public.audit_logs (tenant_id, created_at DESC);
    COMMENT ON INDEX public.audit_logs_tenant_created_at_idx IS 'Suporta auditorias por tenant ordenadas por data.';
  END IF;

  IF to_regclass('public.ixc_connections') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS ixc_connections_tenant_active_created_at_idx
      ON public.ixc_connections (tenant_id, active DESC, created_at ASC);
    COMMENT ON INDEX public.ixc_connections_tenant_active_created_at_idx IS 'Suporta seleção/listagem de conexões IXC ativas por tenant.';
  END IF;

  IF to_regclass('public.pontuacao_campanha_clientes') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS pontuacao_clientes_tenant_ixc_idx
      ON public.pontuacao_campanha_clientes (tenant_id, ixc_cliente_id);
    COMMENT ON INDEX public.pontuacao_clientes_tenant_ixc_idx IS 'Suporta busca de cliente por tenant e identificador IXC.';
  END IF;

  IF to_regclass('public.pontuacao_resgates') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS pontuacao_resgates_tenant_created_at_idx
      ON public.pontuacao_resgates (tenant_id, created_at DESC);
    COMMENT ON INDEX public.pontuacao_resgates_tenant_created_at_idx IS 'Suporta listagem de resgates por tenant ordenada por criação.';
  END IF;

  IF to_regclass('public.pontuacao_catalogo_brindes') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS pontuacao_catalogo_tenant_list_idx
      ON public.pontuacao_catalogo_brindes (tenant_id, ativo DESC, pontos_necessarios ASC, nome ASC);
    COMMENT ON INDEX public.pontuacao_catalogo_tenant_list_idx IS 'Suporta listagem paginada do catálogo por tenant e ordenação da interface.';
  END IF;

  IF to_regclass('public.pontuacao_sync_log') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS pontuacao_sync_log_tenant_created_at_idx
      ON public.pontuacao_sync_log (tenant_id, created_at DESC);
    COMMENT ON INDEX public.pontuacao_sync_log_tenant_created_at_idx IS 'Suporta auditoria de sincronizações recentes por tenant.';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.flood_audit_top_24h AS
SELECT
  COALESCE(user_id, 'anônimo') AS user_id,
  COALESCE(ip_address, 'desconhecido') AS ip_address,
  COUNT(*)::int AS blocked_events,
  COALESCE(SUM(attempts), 0)::int AS blocked_attempts,
  MAX(last_attempt_at) AS last_attempt_at
FROM public.flood_audit_log
WHERE created_at >= now() - interval '24 hours'
GROUP BY COALESCE(user_id, 'anônimo'), COALESCE(ip_address, 'desconhecido')
ORDER BY blocked_attempts DESC, blocked_events DESC
LIMIT 10;

COMMENT ON VIEW public.flood_audit_top_24h IS 'Top 10 usuários/IPs com mais tentativas bloqueadas nas últimas 24h.';
