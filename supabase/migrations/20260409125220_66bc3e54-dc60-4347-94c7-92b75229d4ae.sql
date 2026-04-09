DROP POLICY IF EXISTS tenant_access ON public.tenants;
CREATE POLICY tenant_access ON public.tenants
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.tenant_id = tenants.id
  )
);

DROP POLICY IF EXISTS ixc_conn_access ON public.ixc_connections;
CREATE POLICY ixc_conn_access ON public.ixc_connections
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.tenant_id = ixc_connections.tenant_id
  )
);

DROP POLICY IF EXISTS pontuacao_historico_select_portal_own ON public.pontuacao_historico;