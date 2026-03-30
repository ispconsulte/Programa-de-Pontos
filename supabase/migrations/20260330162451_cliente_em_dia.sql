CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_pontuacao_admin(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE
      u.id = auth.uid() AND
      u.tenant_id = target_tenant_id AND
      u.role IN ('admin', 'owner', 'manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_pontuacao_cliente(target_cliente_id uuid, target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_pontuacao_admin(target_tenant_id)
    OR EXISTS (
      SELECT 1
      FROM public.pontuacao_campanha_clientes c
      WHERE
        c.id = target_cliente_id AND
        c.tenant_id = target_tenant_id AND
        (
          c.auth_user_id = auth.uid()
          OR (
            auth.jwt() ->> 'email' IS NOT NULL AND
            c.email IS NOT NULL AND
            lower(c.email) = lower(auth.jwt() ->> 'email')
          )
        )
    );
$$;

CREATE TABLE IF NOT EXISTS public.pontuacao_campanha_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ixc_cliente_id text NOT NULL,
  ixc_contrato_id text,
  nome_cliente text NOT NULL,
  documento text,
  email text,
  telefone text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'bloqueado')),
  pontos_acumulados integer NOT NULL DEFAULT 0 CHECK (pontos_acumulados >= 0),
  pontos_resgatados integer NOT NULL DEFAULT 0 CHECK (pontos_resgatados >= 0),
  pontos_disponiveis integer GENERATED ALWAYS AS (pontos_acumulados - pontos_resgatados) STORED,
  ultima_sincronizacao_em timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pontuacao_campanha_clientes_resgates_lte_acumulados
    CHECK (pontos_resgatados <= pontos_acumulados),
  CONSTRAINT pontuacao_campanha_clientes_email_format
    CHECK (email IS NULL OR position('@' in email) > 1),
  CONSTRAINT pontuacao_campanha_clientes_documento_not_blank
    CHECK (documento IS NULL OR btrim(documento) <> ''),
  CONSTRAINT pontuacao_campanha_clientes_nome_not_blank
    CHECK (btrim(nome_cliente) <> ''),
  CONSTRAINT pontuacao_campanha_clientes_ixc_cliente_not_blank
    CHECK (btrim(ixc_cliente_id) <> ''),
  CONSTRAINT pontuacao_campanha_clientes_tenant_ixc_cliente_key
    UNIQUE (tenant_id, ixc_cliente_id)
);

CREATE INDEX IF NOT EXISTS pontuacao_campanha_clientes_tenant_status_idx
  ON public.pontuacao_campanha_clientes (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS pontuacao_campanha_clientes_tenant_auth_idx
  ON public.pontuacao_campanha_clientes (tenant_id, auth_user_id);

CREATE INDEX IF NOT EXISTS pontuacao_campanha_clientes_tenant_email_idx
  ON public.pontuacao_campanha_clientes (tenant_id, lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pontuacao_catalogo_brindes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  pontos_necessarios integer NOT NULL CHECK (pontos_necessarios > 0),
  ativo boolean NOT NULL DEFAULT true,
  estoque_disponivel integer CHECK (estoque_disponivel IS NULL OR estoque_disponivel >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pontuacao_catalogo_brindes_nome_not_blank
    CHECK (btrim(nome) <> ''),
  CONSTRAINT pontuacao_catalogo_brindes_tenant_nome_key
    UNIQUE (tenant_id, nome)
);

CREATE INDEX IF NOT EXISTS pontuacao_catalogo_brindes_tenant_ativo_idx
  ON public.pontuacao_catalogo_brindes (tenant_id, ativo, pontos_necessarios, nome);

CREATE TABLE IF NOT EXISTS public.pontuacao_resgates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campanha_cliente_id uuid NOT NULL REFERENCES public.pontuacao_campanha_clientes(id) ON DELETE CASCADE,
  catalogo_brinde_id uuid NOT NULL REFERENCES public.pontuacao_catalogo_brindes(id) ON DELETE RESTRICT,
  solicitado_por_auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'entregue', 'cancelado')),
  pontos_resgatados integer NOT NULL CHECK (pontos_resgatados > 0),
  observacoes text,
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  aprovado_em timestamptz,
  entregue_em timestamptz,
  cancelado_em timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pontuacao_resgates_status_datas_coerentes CHECK (
    (status <> 'aprovado' OR aprovado_em IS NOT NULL) AND
    (status <> 'entregue' OR entregue_em IS NOT NULL) AND
    (status <> 'cancelado' OR cancelado_em IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS pontuacao_resgates_tenant_cliente_idx
  ON public.pontuacao_resgates (tenant_id, campanha_cliente_id, solicitado_em DESC);

CREATE INDEX IF NOT EXISTS pontuacao_resgates_tenant_status_idx
  ON public.pontuacao_resgates (tenant_id, status, solicitado_em DESC);

CREATE TABLE IF NOT EXISTS public.pontuacao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campanha_cliente_id uuid NOT NULL REFERENCES public.pontuacao_campanha_clientes(id) ON DELETE CASCADE,
  resgate_id uuid REFERENCES public.pontuacao_resgates(id) ON DELETE SET NULL,
  tipo_movimentacao text NOT NULL CHECK (tipo_movimentacao IN ('credito', 'debito', 'ajuste', 'resgate', 'estorno')),
  origem text NOT NULL,
  descricao text NOT NULL,
  pontos_movimentados integer NOT NULL CHECK (pontos_movimentados <> 0),
  saldo_apos integer CHECK (saldo_apos IS NULL OR saldo_apos >= 0),
  referencia_externa text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pontuacao_historico_origem_not_blank CHECK (btrim(origem) <> ''),
  CONSTRAINT pontuacao_historico_descricao_not_blank CHECK (btrim(descricao) <> ''),
  CONSTRAINT pontuacao_historico_sinal_coerente CHECK (
    (tipo_movimentacao = 'credito' AND pontos_movimentados > 0) OR
    (tipo_movimentacao = 'estorno' AND pontos_movimentados > 0) OR
    (tipo_movimentacao IN ('debito', 'resgate') AND pontos_movimentados < 0) OR
    (tipo_movimentacao = 'ajuste')
  )
);

CREATE INDEX IF NOT EXISTS pontuacao_historico_tenant_cliente_idx
  ON public.pontuacao_historico (tenant_id, campanha_cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pontuacao_historico_tenant_tipo_idx
  ON public.pontuacao_historico (tenant_id, tipo_movimentacao, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pontuacao_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campanha_cliente_id uuid REFERENCES public.pontuacao_campanha_clientes(id) ON DELETE SET NULL,
  tipo_sync text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'sucesso', 'erro', 'parcial')),
  referencia text,
  mensagem text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pontuacao_sync_log_tipo_sync_not_blank CHECK (btrim(tipo_sync) <> '')
);

CREATE INDEX IF NOT EXISTS pontuacao_sync_log_tenant_status_idx
  ON public.pontuacao_sync_log (tenant_id, status, iniciado_em DESC);

CREATE INDEX IF NOT EXISTS pontuacao_sync_log_tenant_cliente_idx
  ON public.pontuacao_sync_log (tenant_id, campanha_cliente_id, iniciado_em DESC);

CREATE TABLE IF NOT EXISTS public.pontuacao_faturas_processadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campanha_cliente_id uuid REFERENCES public.pontuacao_campanha_clientes(id) ON DELETE SET NULL,
  sync_log_id uuid REFERENCES public.pontuacao_sync_log(id) ON DELETE SET NULL,
  ixc_cliente_id text NOT NULL,
  ixc_contrato_id text,
  fatura_id text NOT NULL,
  competencia text,
  data_pagamento timestamptz,
  valor_pago numeric(12,2) CHECK (valor_pago IS NULL OR valor_pago >= 0),
  pontos_gerados integer NOT NULL DEFAULT 0 CHECK (pontos_gerados >= 0),
  status_processamento text NOT NULL DEFAULT 'processado' CHECK (status_processamento IN ('processado', 'ignorado', 'erro')),
  hash_processamento text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pontuacao_faturas_processadas_ixc_cliente_not_blank CHECK (btrim(ixc_cliente_id) <> ''),
  CONSTRAINT pontuacao_faturas_processadas_fatura_not_blank CHECK (btrim(fatura_id) <> ''),
  CONSTRAINT pontuacao_faturas_processadas_tenant_fatura_key UNIQUE (tenant_id, fatura_id)
);

CREATE INDEX IF NOT EXISTS pontuacao_faturas_processadas_tenant_cliente_idx
  ON public.pontuacao_faturas_processadas (tenant_id, campanha_cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pontuacao_faturas_processadas_tenant_ixc_cliente_idx
  ON public.pontuacao_faturas_processadas (tenant_id, ixc_cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pontuacao_faturas_processadas_tenant_status_idx
  ON public.pontuacao_faturas_processadas (tenant_id, status_processamento, created_at DESC);

DROP TRIGGER IF EXISTS set_updated_at_pontuacao_campanha_clientes ON public.pontuacao_campanha_clientes;
CREATE TRIGGER set_updated_at_pontuacao_campanha_clientes
BEFORE UPDATE ON public.pontuacao_campanha_clientes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_pontuacao_catalogo_brindes ON public.pontuacao_catalogo_brindes;
CREATE TRIGGER set_updated_at_pontuacao_catalogo_brindes
BEFORE UPDATE ON public.pontuacao_catalogo_brindes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_pontuacao_resgates ON public.pontuacao_resgates;
CREATE TRIGGER set_updated_at_pontuacao_resgates
BEFORE UPDATE ON public.pontuacao_resgates
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_pontuacao_sync_log ON public.pontuacao_sync_log;
CREATE TRIGGER set_updated_at_pontuacao_sync_log
BEFORE UPDATE ON public.pontuacao_sync_log
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_pontuacao_faturas_processadas ON public.pontuacao_faturas_processadas;
CREATE TRIGGER set_updated_at_pontuacao_faturas_processadas
BEFORE UPDATE ON public.pontuacao_faturas_processadas
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.pontuacao_catalogo_brindes (
  tenant_id,
  nome,
  pontos_necessarios
)
SELECT
  t.id,
  seed.nome,
  seed.pontos_necessarios
FROM public.tenants t
CROSS JOIN (
  VALUES
    ('Caneta Touch', 5),
    ('Copo Twist', 10),
    ('Mouse Pad', 15),
    ('Bolsinha de Academia', 20),
    ('Squeeze Personalizado', 25),
    ('Caixa Térmica Personalizada', 50)
) AS seed(nome, pontos_necessarios)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.pontuacao_catalogo_brindes pcb
  WHERE
    pcb.tenant_id = t.id AND
    pcb.nome = seed.nome
);

ALTER TABLE public.pontuacao_campanha_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_catalogo_brindes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_resgates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_faturas_processadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pontuacao_campanha_clientes_admin_all ON public.pontuacao_campanha_clientes;
CREATE POLICY pontuacao_campanha_clientes_admin_all
ON public.pontuacao_campanha_clientes
FOR ALL
USING (public.is_pontuacao_admin(tenant_id))
WITH CHECK (public.is_pontuacao_admin(tenant_id));

DROP POLICY IF EXISTS pontuacao_campanha_clientes_portal_select ON public.pontuacao_campanha_clientes;
CREATE POLICY pontuacao_campanha_clientes_portal_select
ON public.pontuacao_campanha_clientes
FOR SELECT
USING (
  public.is_pontuacao_admin(tenant_id)
  OR (
    auth.uid() IS NOT NULL AND
    (
      auth_user_id = auth.uid()
      OR (
        auth.jwt() ->> 'email' IS NOT NULL AND
        email IS NOT NULL AND
        lower(email) = lower(auth.jwt() ->> 'email')
      )
    )
  )
);

DROP POLICY IF EXISTS pontuacao_historico_admin_all ON public.pontuacao_historico;
CREATE POLICY pontuacao_historico_admin_all
ON public.pontuacao_historico
FOR ALL
USING (public.is_pontuacao_admin(tenant_id))
WITH CHECK (public.is_pontuacao_admin(tenant_id));

DROP POLICY IF EXISTS pontuacao_historico_portal_select ON public.pontuacao_historico;
CREATE POLICY pontuacao_historico_portal_select
ON public.pontuacao_historico
FOR SELECT
USING (public.can_access_pontuacao_cliente(campanha_cliente_id, tenant_id));

DROP POLICY IF EXISTS pontuacao_resgates_admin_all ON public.pontuacao_resgates;
CREATE POLICY pontuacao_resgates_admin_all
ON public.pontuacao_resgates
FOR ALL
USING (public.is_pontuacao_admin(tenant_id))
WITH CHECK (public.is_pontuacao_admin(tenant_id));

DROP POLICY IF EXISTS pontuacao_resgates_portal_select ON public.pontuacao_resgates;
CREATE POLICY pontuacao_resgates_portal_select
ON public.pontuacao_resgates
FOR SELECT
USING (public.can_access_pontuacao_cliente(campanha_cliente_id, tenant_id));

DROP POLICY IF EXISTS pontuacao_catalogo_brindes_admin_all ON public.pontuacao_catalogo_brindes;
CREATE POLICY pontuacao_catalogo_brindes_admin_all
ON public.pontuacao_catalogo_brindes
FOR ALL
USING (public.is_pontuacao_admin(tenant_id))
WITH CHECK (public.is_pontuacao_admin(tenant_id));

DROP POLICY IF EXISTS pontuacao_catalogo_brindes_portal_select ON public.pontuacao_catalogo_brindes;
CREATE POLICY pontuacao_catalogo_brindes_portal_select
ON public.pontuacao_catalogo_brindes
FOR SELECT
USING (
  public.is_pontuacao_admin(tenant_id)
  OR (
    ativo = true AND
    EXISTS (
      SELECT 1
      FROM public.pontuacao_campanha_clientes c
      WHERE
        c.tenant_id = pontuacao_catalogo_brindes.tenant_id AND
        (
          c.auth_user_id = auth.uid()
          OR (
            auth.jwt() ->> 'email' IS NOT NULL AND
            c.email IS NOT NULL AND
            lower(c.email) = lower(auth.jwt() ->> 'email')
          )
        )
    )
  )
);

DROP POLICY IF EXISTS pontuacao_sync_log_admin_all ON public.pontuacao_sync_log;
CREATE POLICY pontuacao_sync_log_admin_all
ON public.pontuacao_sync_log
FOR ALL
USING (public.is_pontuacao_admin(tenant_id))
WITH CHECK (public.is_pontuacao_admin(tenant_id));

DROP POLICY IF EXISTS pontuacao_faturas_processadas_admin_all ON public.pontuacao_faturas_processadas;
CREATE POLICY pontuacao_faturas_processadas_admin_all
ON public.pontuacao_faturas_processadas
FOR ALL
USING (public.is_pontuacao_admin(tenant_id))
WITH CHECK (public.is_pontuacao_admin(tenant_id));
