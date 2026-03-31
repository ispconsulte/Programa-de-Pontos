
-- ============================================================
-- 1. Add missing RLS policies for CRUD operations
-- ============================================================

-- TENANTS: allow authenticated users who belong to tenant to UPDATE
CREATE POLICY "tenant_update_own"
ON public.tenants
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.tenant_id = tenants.id))
WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.tenant_id = tenants.id));

-- IXC_CONNECTIONS: allow INSERT for authenticated users of the tenant
CREATE POLICY "ixc_conn_insert"
ON public.ixc_connections
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.tenant_id = ixc_connections.tenant_id));

-- IXC_CONNECTIONS: allow UPDATE for authenticated users of the tenant
CREATE POLICY "ixc_conn_update"
ON public.ixc_connections
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.tenant_id = ixc_connections.tenant_id))
WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.tenant_id = ixc_connections.tenant_id));

-- PONTUACAO_FATURAS_PROCESSADAS: enable RLS and add SELECT policy for authenticated tenant users
ALTER TABLE public.pontuacao_faturas_processadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faturas_processadas_select"
ON public.pontuacao_faturas_processadas
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.tenant_id = pontuacao_faturas_processadas.tenant_id));

-- PONTUACAO_SYNC_LOG: enable RLS and add SELECT policy for any authenticated user
ALTER TABLE public.pontuacao_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_log_select_authenticated"
ON public.pontuacao_sync_log
FOR SELECT
TO authenticated
USING (true);

-- CAMPAIGN_EVENTS: enable RLS and add SELECT policy for authenticated tenant users
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_events_select"
ON public.campaign_events
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.tenant_id = campaign_events.tenant_id));

-- REWARD_REDEMPTIONS: enable RLS and add SELECT policy for authenticated tenant users
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reward_redemptions_select"
ON public.reward_redemptions
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.tenant_id = reward_redemptions.tenant_id));

-- PONTUACAO_CAMPANHA_CLIENTES: add INSERT/UPDATE for authenticated tenant users
CREATE POLICY "campanha_clientes_insert"
ON public.pontuacao_campanha_clientes
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.tenant_id = pontuacao_campanha_clientes.tenant_id));

CREATE POLICY "campanha_clientes_update"
ON public.pontuacao_campanha_clientes
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.tenant_id = pontuacao_campanha_clientes.tenant_id))
WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.tenant_id = pontuacao_campanha_clientes.tenant_id));

-- PONTUACAO_CAMPANHA_CLIENTES: add SELECT for authenticated tenant users (admin)
CREATE POLICY "campanha_clientes_select_admin"
ON public.pontuacao_campanha_clientes
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.tenant_id = pontuacao_campanha_clientes.tenant_id));

-- ============================================================
-- 2. Add foreign key for receivables join (pontuacao_faturas_processadas -> pontuacao_campanha_clientes)
-- ============================================================
ALTER TABLE public.pontuacao_faturas_processadas
ADD CONSTRAINT fk_faturas_campanha_cliente
FOREIGN KEY (campanha_cliente_id) REFERENCES public.pontuacao_campanha_clientes(id)
ON DELETE SET NULL;

-- ============================================================
-- 3. Add foreign key for tenant references
-- ============================================================
ALTER TABLE public.pontuacao_faturas_processadas
ADD CONSTRAINT fk_faturas_tenant
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
ON DELETE CASCADE;
