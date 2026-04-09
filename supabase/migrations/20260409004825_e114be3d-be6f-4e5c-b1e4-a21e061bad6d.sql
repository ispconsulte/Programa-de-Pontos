
-- =====================================================
-- FIX 1: pontuacao_resgates – replace JWT claim policy
-- =====================================================

-- Drop the unsafe public JWT claim policy
DROP POLICY IF EXISTS "cliente_em_dia_resgates_select_own" ON pontuacao_resgates;

-- Add tenant-scoped admin read policy
CREATE POLICY "pontuacao_resgates_admin_select"
ON pontuacao_resgates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM pontuacao_campanha_clientes c
    JOIN users u ON u.tenant_id = c.tenant_id
    WHERE c.ixc_cliente_id = pontuacao_resgates.ixc_cliente_id
      AND u.id = auth.uid()
      AND u.role IN ('admin', 'owner', 'manager')
  )
);

-- Add portal user read policy (auth.uid() verified ownership)
CREATE POLICY "pontuacao_resgates_portal_select"
ON pontuacao_resgates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM pontuacao_campanha_clientes c
    WHERE c.ixc_cliente_id = pontuacao_resgates.ixc_cliente_id
      AND c.auth_user_id = auth.uid()
  )
);

-- =====================================================
-- FIX 2: pontuacao_historico – add tenant_id column
-- =====================================================

-- Add tenant_id column (nullable initially for backfill)
ALTER TABLE pontuacao_historico
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);

-- Backfill tenant_id from pontuacao_campanha_clientes
UPDATE pontuacao_historico h
SET tenant_id = (
  SELECT c.tenant_id
  FROM pontuacao_campanha_clientes c
  WHERE c.ixc_cliente_id = h.ixc_cliente_id
  LIMIT 1
)
WHERE h.tenant_id IS NULL;

-- Drop the old insecure tenant-scoped policy
DROP POLICY IF EXISTS "pontuacao_historico_select_own_tenant" ON pontuacao_historico;

-- Add a direct tenant_id-based admin select policy
CREATE POLICY "pontuacao_historico_admin_select"
ON pontuacao_historico
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = pontuacao_historico.tenant_id
  )
);
