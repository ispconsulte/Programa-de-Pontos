ALTER TABLE public.pontuacao_resgates
ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.pontuacao_resgates r
SET tenant_id = c.tenant_id
FROM public.pontuacao_campanha_clientes c
WHERE c.ixc_cliente_id = r.ixc_cliente_id
  AND r.tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_pontuacao_resgates_tenant_cliente
  ON public.pontuacao_resgates (tenant_id, ixc_cliente_id, created_at DESC);

DROP POLICY IF EXISTS cliente_em_dia_clientes_select_own ON public.pontuacao_campanha_clientes;
DROP POLICY IF EXISTS cliente_em_dia_catalogo_select_ativo ON public.pontuacao_catalogo_brindes;
DROP POLICY IF EXISTS pontuacao_resgates_admin_select ON public.pontuacao_resgates;
DROP POLICY IF EXISTS pontuacao_resgates_portal_select ON public.pontuacao_resgates;
DROP POLICY IF EXISTS pontuacao_catalogo_brindes_portal_select ON public.pontuacao_catalogo_brindes;

CREATE POLICY pontuacao_catalogo_brindes_authenticated_select
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
);

CREATE POLICY pontuacao_catalogo_brindes_admin_insert
ON public.pontuacao_catalogo_brindes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text])
  )
);

CREATE POLICY pontuacao_catalogo_brindes_admin_update
ON public.pontuacao_catalogo_brindes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text])
  )
);

CREATE POLICY pontuacao_catalogo_brindes_admin_delete
ON public.pontuacao_catalogo_brindes
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text])
  )
);

CREATE POLICY pontuacao_resgates_admin_select
ON public.pontuacao_resgates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = pontuacao_resgates.tenant_id
      AND u.is_active = true
  )
);

CREATE POLICY pontuacao_resgates_portal_select
ON public.pontuacao_resgates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.pontuacao_campanha_clientes c
    WHERE c.ixc_cliente_id = pontuacao_resgates.ixc_cliente_id
      AND c.tenant_id = pontuacao_resgates.tenant_id
      AND c.auth_user_id = auth.uid()
  )
);

CREATE POLICY pontuacao_resgates_admin_insert
ON public.pontuacao_resgates
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = pontuacao_resgates.tenant_id
      AND u.is_active = true
      AND u.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text])
  )
);

CREATE POLICY pontuacao_resgates_admin_update
ON public.pontuacao_resgates
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = pontuacao_resgates.tenant_id
      AND u.is_active = true
      AND u.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = pontuacao_resgates.tenant_id
      AND u.is_active = true
      AND u.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text])
  )
);

CREATE POLICY pontuacao_resgates_admin_delete
ON public.pontuacao_resgates
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = pontuacao_resgates.tenant_id
      AND u.is_active = true
      AND u.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text])
  )
);

ALTER TABLE public.pontuacao_resgates
ALTER COLUMN tenant_id SET NOT NULL;