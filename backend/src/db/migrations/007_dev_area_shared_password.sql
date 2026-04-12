ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS dev_area_shared_password_hash TEXT NOT NULL DEFAULT '$2a$10$x2NRuOKYljoMQs798ogTO./NqrJs66hjxTugMyApol4TxNJ3S.Ko.';
