-- Final hardening pass for legacy policies and unsafe role assumptions.

ALTER TABLE public.users
  ALTER COLUMN role SET DEFAULT 'operator';

UPDATE public.users
SET role = 'operator'
WHERE role IS NULL OR btrim(role) = '';

ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_campanha_clientes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_historico FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_resgates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_catalogo_brindes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_sync_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.tenants;
DROP POLICY IF EXISTS user_isolation ON public.users;
DROP POLICY IF EXISTS audit_isolation ON public.audit_logs;
DROP POLICY IF EXISTS user_read_own ON public.users;
DROP POLICY IF EXISTS user_read_own_profile ON public.users;

CREATE POLICY user_read_own_profile
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Browser clients should never mutate tenant or integration configuration directly.
DROP POLICY IF EXISTS "tenant_update_own" ON public.tenants;
DROP POLICY IF EXISTS "ixc_conn_insert" ON public.ixc_connections;
DROP POLICY IF EXISTS "ixc_conn_update" ON public.ixc_connections;

CREATE OR REPLACE FUNCTION public.is_pontuacao_admin(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = target_tenant_id
      AND u.is_active = true
      AND u.role IN ('admin', 'owner', 'manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_pontuacao_cliente(target_cliente_id uuid, target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_pontuacao_admin(target_tenant_id)
    OR EXISTS (
      SELECT 1
      FROM public.pontuacao_campanha_clientes c
      WHERE c.id = target_cliente_id
        AND c.tenant_id = target_tenant_id
        AND c.auth_user_id = auth.uid()
    );
$$;

DROP POLICY IF EXISTS "campanha_clientes_insert" ON public.pontuacao_campanha_clientes;
DROP POLICY IF EXISTS "campanha_clientes_update" ON public.pontuacao_campanha_clientes;
DROP POLICY IF EXISTS "campanha_clientes_select_admin" ON public.pontuacao_campanha_clientes;
DROP POLICY IF EXISTS pontuacao_campanha_clientes_admin_all ON public.pontuacao_campanha_clientes;
DROP POLICY IF EXISTS pontuacao_campanha_clientes_portal_select ON public.pontuacao_campanha_clientes;

CREATE POLICY pontuacao_campanha_clientes_admin_all
ON public.pontuacao_campanha_clientes
FOR ALL
TO authenticated
USING (public.is_pontuacao_admin(tenant_id))
WITH CHECK (public.is_pontuacao_admin(tenant_id));

CREATE POLICY pontuacao_campanha_clientes_portal_select
ON public.pontuacao_campanha_clientes
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND auth_user_id = auth.uid()
);

DROP POLICY IF EXISTS pontuacao_historico_portal_select ON public.pontuacao_historico;
DROP POLICY IF EXISTS pontuacao_historico_select_portal_own ON public.pontuacao_historico;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pontuacao_historico'
      AND column_name = 'campanha_cliente_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pontuacao_historico'
      AND column_name = 'tenant_id'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY pontuacao_historico_portal_select
      ON public.pontuacao_historico
      FOR SELECT
      TO authenticated
      USING (public.can_access_pontuacao_cliente(campanha_cliente_id, tenant_id))
    $sql$;

    EXECUTE $sql$
      CREATE POLICY pontuacao_historico_select_portal_own
      ON public.pontuacao_historico
      FOR SELECT
      TO authenticated
      USING (public.can_access_pontuacao_cliente(campanha_cliente_id, tenant_id))
    $sql$;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pontuacao_historico'
      AND column_name = 'ixc_cliente_id'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY pontuacao_historico_portal_select
      ON public.pontuacao_historico
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.pontuacao_campanha_clientes c
          WHERE c.ixc_cliente_id = pontuacao_historico.ixc_cliente_id
            AND c.auth_user_id = auth.uid()
        )
      )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY pontuacao_historico_select_portal_own
      ON public.pontuacao_historico
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.pontuacao_campanha_clientes c
          WHERE c.ixc_cliente_id = pontuacao_historico.ixc_cliente_id
            AND c.auth_user_id = auth.uid()
        )
      )
    $sql$;
  END IF;
END
$$;

DROP POLICY IF EXISTS pontuacao_resgates_portal_select ON public.pontuacao_resgates;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pontuacao_resgates'
      AND column_name = 'campanha_cliente_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pontuacao_resgates'
      AND column_name = 'tenant_id'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY pontuacao_resgates_portal_select
      ON public.pontuacao_resgates
      FOR SELECT
      TO authenticated
      USING (public.can_access_pontuacao_cliente(campanha_cliente_id, tenant_id))
    $sql$;
  END IF;
END
$$;

DROP POLICY IF EXISTS pontuacao_catalogo_brindes_portal_select ON public.pontuacao_catalogo_brindes;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pontuacao_catalogo_brindes'
      AND column_name = 'tenant_id'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY pontuacao_catalogo_brindes_portal_select
      ON public.pontuacao_catalogo_brindes
      FOR SELECT
      TO authenticated
      USING (
        public.is_pontuacao_admin(tenant_id)
        OR (
          ativo = true
          AND EXISTS (
            SELECT 1
            FROM public.pontuacao_campanha_clientes c
            WHERE c.tenant_id = pontuacao_catalogo_brindes.tenant_id
              AND c.auth_user_id = auth.uid()
          )
        )
      )
    $sql$;
  ELSE
    EXECUTE $sql$
      CREATE POLICY pontuacao_catalogo_brindes_portal_select
      ON public.pontuacao_catalogo_brindes
      FOR SELECT
      TO authenticated
      USING (
        ativo = true
        AND EXISTS (
          SELECT 1
          FROM public.pontuacao_campanha_clientes c
          WHERE c.auth_user_id = auth.uid()
        )
      )
    $sql$;
  END IF;
END
$$;
