-- IXC credentials are now configured post-registration via /settings
ALTER TABLE tenants
  ALTER COLUMN ixc_base_url DROP NOT NULL,
  ALTER COLUMN ixc_user     DROP NOT NULL,
  ALTER COLUMN ixc_token_enc DROP NOT NULL,
  ALTER COLUMN ixc_token_iv  DROP NOT NULL;

-- Store tenant name derived from email on registration
ALTER TABLE tenants
  ALTER COLUMN name SET DEFAULT '';
