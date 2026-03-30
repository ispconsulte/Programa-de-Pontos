ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies use current_setting('app.tenant_id') set by the application
CREATE POLICY tenant_isolation ON tenants
  USING (id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY user_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY audit_isolation ON audit_logs
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
