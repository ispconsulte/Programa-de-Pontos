ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_access ON tenants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.tenant_id = tenants.id
    )
  );

CREATE POLICY user_read_own_profile ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY audit_logs_select_own_tenant ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.tenant_id = audit_logs.tenant_id
    )
  );
