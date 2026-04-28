CREATE TABLE IF NOT EXISTS public.pontuacao_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  telefone text NOT NULL,
  origem text NOT NULL DEFAULT 'manual',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pontuacao_contatos_nome_not_blank CHECK (btrim(nome) <> ''),
  CONSTRAINT pontuacao_contatos_telefone_not_blank CHECK (btrim(telefone) <> ''),
  CONSTRAINT pontuacao_contatos_tenant_telefone_key UNIQUE (tenant_id, telefone)
);

CREATE INDEX IF NOT EXISTS pontuacao_contatos_tenant_created_idx
  ON public.pontuacao_contatos (tenant_id, created_at DESC);

ALTER TABLE public.pontuacao_resgates
  ALTER COLUMN ixc_cliente_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS contato_id uuid REFERENCES public.pontuacao_contatos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_destinatario text NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS destinatario_nome text,
  ADD COLUMN IF NOT EXISTS destinatario_telefone text,
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_reason text;

ALTER TABLE public.pontuacao_historico
  ALTER COLUMN ixc_cliente_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS contato_id uuid REFERENCES public.pontuacao_contatos(id) ON DELETE SET NULL;

UPDATE public.pontuacao_resgates r
SET destinatario_nome = c.nome_cliente
FROM public.pontuacao_campanha_clientes c
WHERE r.destinatario_nome IS NULL
  AND r.tenant_id = c.tenant_id
  AND r.ixc_cliente_id = c.ixc_cliente_id;
