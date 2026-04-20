-- Scope reward catalog mutations to the authenticated user's tenant and
-- explicitly deny browser writes to backend-owned tables.

ALTER TABLE public.pontuacao_catalogo_brindes
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

UPDATE public.pontuacao_catalogo_brindes
SET tenant_id = (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1)
WHERE tenant_id IS NULL
  AND (SELECT count(*) FROM public.tenants) = 1;

CREATE INDEX IF NOT EXISTS pontuacao_catalogo_brindes_tenant_ativo_idx
  ON public.pontuacao_catalogo_brindes (tenant_id, ativo, pontos_necessarios, nome);

ALTER TABLE public.pontuacao_catalogo_brindes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_catalogo_brindes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pontuacao_catalogo_brindes_admin_all ON public.pontuacao_catalogo_brindes;
DROP POLICY IF EXISTS pontuacao_catalogo_brindes_authenticated_select ON public.pontuacao_catalogo_brindes;
DROP POLICY IF EXISTS pontuacao_catalogo_brindes_admin_insert ON public.pontuacao_catalogo_brindes;
DROP POLICY IF EXISTS pontuacao_catalogo_brindes_admin_update ON public.pontuacao_catalogo_brindes;
DROP POLICY IF EXISTS pontuacao_catalogo_brindes_admin_delete ON public.pontuacao_catalogo_brindes;
DROP POLICY IF EXISTS pontuacao_catalogo_brindes_portal_select ON public.pontuacao_catalogo_brindes;

CREATE POLICY pontuacao_catalogo_brindes_tenant_select
ON public.pontuacao_catalogo_brindes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = pontuacao_catalogo_brindes.tenant_id
      AND u.is_active = true
      AND u.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text])
  )
  OR (
    ativo = true
    AND EXISTS (
      SELECT 1
      FROM public.pontuacao_campanha_clientes c
      WHERE c.tenant_id = pontuacao_catalogo_brindes.tenant_id
        AND c.auth_user_id = auth.uid()
    )
  )
);

CREATE POLICY pontuacao_catalogo_brindes_tenant_insert
ON public.pontuacao_catalogo_brindes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = pontuacao_catalogo_brindes.tenant_id
      AND u.is_active = true
      AND u.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text])
  )
);

CREATE POLICY pontuacao_catalogo_brindes_tenant_update
ON public.pontuacao_catalogo_brindes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = pontuacao_catalogo_brindes.tenant_id
      AND u.is_active = true
      AND u.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = pontuacao_catalogo_brindes.tenant_id
      AND u.is_active = true
      AND u.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text])
  )
);

CREATE POLICY pontuacao_catalogo_brindes_tenant_delete
ON public.pontuacao_catalogo_brindes
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = pontuacao_catalogo_brindes.tenant_id
      AND u.is_active = true
      AND u.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text])
  )
);

DROP POLICY IF EXISTS pontuacao_sync_log_admin_all ON public.pontuacao_sync_log;

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'users',
    'audit_logs',
    'pontuacao_sync_log',
    'pontuacao_sync_state'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', target_table);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', target_table || '_deny_browser_insert', target_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', target_table || '_deny_browser_update', target_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', target_table || '_deny_browser_delete', target_table);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false)',
      target_table || '_deny_browser_insert',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false)',
      target_table || '_deny_browser_update',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (false)',
      target_table || '_deny_browser_delete',
      target_table
    );
  END LOOP;
END
$$;
