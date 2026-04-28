ALTER TABLE public.pontuacao_catalogo_brindes
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_reason text;

CREATE INDEX IF NOT EXISTS pontuacao_catalogo_brindes_tenant_ativo_idx
  ON public.pontuacao_catalogo_brindes (tenant_id, ativo, pontos_necessarios, nome);

CREATE INDEX IF NOT EXISTS pontuacao_catalogo_brindes_deleted_by_idx
  ON public.pontuacao_catalogo_brindes (deleted_by);
