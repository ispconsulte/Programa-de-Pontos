-- 001_initial
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ixc_base_url TEXT NOT NULL,
  ixc_user TEXT NOT NULL,
  ixc_token_enc BYTEA NOT NULL,
  ixc_token_iv BYTEA NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID,
  action TEXT NOT NULL,
  ixc_endpoint TEXT NOT NULL,
  http_status INT,
  ip_addr INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE RULE no_update_audit AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- 002_rls
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
