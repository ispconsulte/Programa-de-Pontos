CREATE TABLE IF NOT EXISTS campaign_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reward_code TEXT NOT NULL,
  name TEXT NOT NULL,
  points_required INT NOT NULL CHECK (points_required > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, reward_code)
);

CREATE INDEX IF NOT EXISTS campaign_rewards_lookup_idx
  ON campaign_rewards (tenant_id, active, reward_code);
