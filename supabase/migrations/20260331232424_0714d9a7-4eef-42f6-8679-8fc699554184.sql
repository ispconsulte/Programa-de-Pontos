ALTER TABLE public.pontuacao_sync_log
  ADD COLUMN IF NOT EXISTS referencia text,
  ADD COLUMN IF NOT EXISTS tipo_sync text;