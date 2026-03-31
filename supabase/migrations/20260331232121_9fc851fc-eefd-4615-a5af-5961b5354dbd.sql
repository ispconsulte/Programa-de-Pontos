ALTER TABLE public.pontuacao_sync_log
  ADD COLUMN IF NOT EXISTS mensagem text,
  ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS finalizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id),
  ADD COLUMN IF NOT EXISTS ixc_connection_id uuid,
  ADD COLUMN IF NOT EXISTS iniciado_em timestamptz DEFAULT now();