CREATE TABLE IF NOT EXISTS ixc_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  ixc_base_url TEXT NOT NULL,
  ixc_user TEXT NOT NULL,
  ixc_token_enc BYTEA NOT NULL,
  ixc_token_iv BYTEA NOT NULL,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ixc_connections_one_active_per_tenant
  ON ixc_connections (tenant_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS ixc_connections_tenant_idx
  ON ixc_connections (tenant_id, created_at DESC);

INSERT INTO ixc_connections (
  tenant_id,
  name,
  ixc_base_url,
  ixc_user,
  ixc_token_enc,
  ixc_token_iv,
  active
)
SELECT
  t.id,
  'default',
  t.ixc_base_url,
  t.ixc_user,
  t.ixc_token_enc,
  t.ixc_token_iv,
  true
FROM tenants t
WHERE
  t.ixc_base_url IS NOT NULL AND
  t.ixc_user IS NOT NULL AND
  t.ixc_token_enc IS NOT NULL AND
  t.ixc_token_iv IS NOT NULL AND
  NOT EXISTS (
    SELECT 1
    FROM ixc_connections c
    WHERE c.tenant_id = t.id
  );

CREATE TABLE IF NOT EXISTS campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ixc_connection_id UUID REFERENCES ixc_connections(id) ON DELETE SET NULL,
  customer_id TEXT,
  contract_id TEXT,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL,
  source_reference_type TEXT,
  source_reference_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  points INT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS campaign_events_tenant_customer_idx
  ON campaign_events (tenant_id, customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS campaign_events_tenant_contract_idx
  ON campaign_events (tenant_id, contract_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ixc_connection_id UUID REFERENCES ixc_connections(id) ON DELETE SET NULL,
  customer_id TEXT NOT NULL,
  reward_code TEXT NOT NULL,
  points_spent INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS reward_redemptions_tenant_customer_idx
  ON reward_redemptions (tenant_id, customer_id, created_at DESC);
