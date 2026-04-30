CREATE TABLE IF NOT EXISTS public.regioes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regioes_nome_not_blank CHECK (btrim(nome) <> ''),
  CONSTRAINT regioes_tenant_nome_key UNIQUE (tenant_id, nome)
);

CREATE INDEX IF NOT EXISTS regioes_tenant_idx ON public.regioes (tenant_id);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS regiao_id uuid REFERENCES public.regioes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_regiao_idx ON public.users (regiao_id);

ALTER TABLE public.pontuacao_catalogo_brindes
  ADD COLUMN IF NOT EXISTS regiao_id uuid REFERENCES public.regioes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pontuacao_catalogo_brindes_tenant_regiao_idx
  ON public.pontuacao_catalogo_brindes (tenant_id, regiao_id);

ALTER TABLE public.regioes ENABLE ROW LEVEL SECURITY;

CREATE POLICY regioes_tenant_isolation ON public.regioes
  FOR ALL TO authenticated
  USING (
    tenant_id = (
      SELECT u.tenant_id FROM public.users u WHERE u.id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_full_admin = true
    )
  );
