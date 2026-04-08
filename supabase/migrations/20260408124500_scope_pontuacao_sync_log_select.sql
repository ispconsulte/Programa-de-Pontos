DROP POLICY IF EXISTS sync_log_select_authenticated ON public.pontuacao_sync_log;

CREATE POLICY pontuacao_sync_log_select_own_tenant
ON public.pontuacao_sync_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = auth.uid()
      AND users.tenant_id = pontuacao_sync_log.tenant_id
  )
);
