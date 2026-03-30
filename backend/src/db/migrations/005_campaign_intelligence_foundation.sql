CREATE TABLE IF NOT EXISTS customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  display_name TEXT,
  document_number TEXT,
  email TEXT,
  phone TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_profiles_tenant_idx
  ON customer_profiles (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS customer_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_profile_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_connection_id UUID REFERENCES ixc_connections(id) ON DELETE SET NULL,
  external_customer_id TEXT NOT NULL,
  external_contract_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_type, source_connection_id, external_customer_id)
);

CREATE INDEX IF NOT EXISTS customer_identities_profile_idx
  ON customer_identities (tenant_id, customer_profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS campaign_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  rule_code TEXT NOT NULL,
  points INT NOT NULL,
  description TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  priority INT NOT NULL DEFAULT 100,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_rules_lookup_idx
  ON campaign_rules (tenant_id, event_type, active, priority, starts_at, ends_at);

ALTER TABLE campaign_events
  ADD COLUMN IF NOT EXISTS customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS rule_code TEXT;

CREATE INDEX IF NOT EXISTS campaign_events_profile_idx
  ON campaign_events (tenant_id, customer_profile_id, created_at DESC);

ALTER TABLE reward_redemptions
  ADD COLUMN IF NOT EXISTS customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS reward_redemptions_profile_idx
  ON reward_redemptions (tenant_id, customer_profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS campaign_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  event_type TEXT NOT NULL,
  target_value INT NOT NULL DEFAULT 1,
  reward_points INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS campaign_missions_active_idx
  ON campaign_missions (tenant_id, active, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS campaign_mission_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES campaign_missions(id) ON DELETE CASCADE,
  customer_profile_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  progress_value INT NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  last_event_id UUID REFERENCES campaign_events(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, mission_id, customer_profile_id)
);

CREATE INDEX IF NOT EXISTS campaign_mission_progress_lookup_idx
  ON campaign_mission_progress (tenant_id, customer_profile_id, completed, updated_at DESC);
