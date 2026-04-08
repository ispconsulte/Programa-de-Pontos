-- Browser clients must not read tenant-level IXC credentials directly.
REVOKE ALL (ixc_base_url, ixc_user, ixc_token_enc, ixc_token_iv) ON public.tenants FROM PUBLIC;
REVOKE ALL (ixc_base_url, ixc_user, ixc_token_enc, ixc_token_iv) ON public.tenants FROM anon;
REVOKE ALL (ixc_base_url, ixc_user, ixc_token_enc, ixc_token_iv) ON public.tenants FROM authenticated;

REVOKE ALL (ixc_base_url, ixc_user, ixc_token_enc, ixc_token_iv) ON public.ixc_connections FROM PUBLIC;
REVOKE ALL (ixc_base_url, ixc_user, ixc_token_enc, ixc_token_iv) ON public.ixc_connections FROM anon;
REVOKE ALL (ixc_base_url, ixc_user, ixc_token_enc, ixc_token_iv) ON public.ixc_connections FROM authenticated;

-- Legacy points history rows do not carry tenant_id in this project, so
-- tenant isolation must be derived from a trusted membership table instead of
-- relying on raw ixc_cliente_id alone.
DROP POLICY IF EXISTS cliente_em_dia_historico_select_own ON public.pontuacao_historico;
DROP POLICY IF EXISTS pontuacao_historico_select_own_tenant ON public.pontuacao_historico;
DROP POLICY IF EXISTS pontuacao_historico_select_portal_own ON public.pontuacao_historico;

CREATE POLICY pontuacao_historico_select_own_tenant
ON public.pontuacao_historico
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.pontuacao_campanha_clientes c
      ON c.tenant_id = u.tenant_id
     AND c.ixc_cliente_id = pontuacao_historico.ixc_cliente_id
    WHERE u.id = auth.uid()
  )
);

CREATE POLICY pontuacao_historico_select_portal_own
ON public.pontuacao_historico
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.pontuacao_campanha_clientes c
    WHERE c.ixc_cliente_id = pontuacao_historico.ixc_cliente_id
      AND (
        c.auth_user_id = auth.uid()
        OR (
          auth.jwt() ->> 'email' IS NOT NULL
          AND c.email IS NOT NULL
          AND lower(c.email) = lower(auth.jwt() ->> 'email')
        )
      )
  )
);
