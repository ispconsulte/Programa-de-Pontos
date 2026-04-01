-- Sync-first data model:
-- 1) raw receivables ingestion (no points calculation)
-- 2) mirrored IXC customers
-- 3) points ledger and balances separated from sync
-- 4) incremental sync state (watermark)

-- ---------------------------------------------------------------------
-- Updated-at trigger helper (safe)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- IXC customer mirror
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ixc_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ixc_cliente_id text NOT NULL,
  nome text NOT NULL,
  documento text,
  email text,
  telefone text,
  ativo text,
  ultima_atualizacao_ixc timestamptz,
  payload_raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ixc_clientes_ixc_cliente_not_blank CHECK (btrim(ixc_cliente_id) <> ''),
  CONSTRAINT ixc_clientes_nome_not_blank CHECK (btrim(nome) <> ''),
  CONSTRAINT ixc_clientes_tenant_ixc_cliente_key UNIQUE (tenant_id, ixc_cliente_id)
);

CREATE INDEX IF NOT EXISTS ixc_clientes_tenant_updated_idx
  ON public.ixc_clientes (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ixc_clientes_tenant_documento_idx
  ON public.ixc_clientes (tenant_id, documento)
  WHERE documento IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at_ixc_clientes ON public.ixc_clientes;
CREATE TRIGGER set_updated_at_ixc_clientes
BEFORE UPDATE ON public.ixc_clientes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- Raw receivables table (sync only, no points)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ixc_recebiveis_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ixc_connection_id uuid NOT NULL REFERENCES public.ixc_connections(id) ON DELETE RESTRICT,
  ixc_recebivel_id text NOT NULL,
  ixc_cliente_id text NOT NULL,
  ixc_contrato_id text,
  status text NOT NULL,
  data_vencimento date,
  data_pagamento timestamptz,
  valor numeric(12,2),
  valor_recebido numeric(12,2) NOT NULL,
  ultima_atualizacao_ixc timestamptz,
  hash_payload text NOT NULL,
  payload_raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  processado_pontuacao boolean NOT NULL DEFAULT false,
  processado_pontuacao_em timestamptz,
  primeiro_sync_em timestamptz NOT NULL DEFAULT now(),
  ultimo_sync_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ixc_recebiveis_raw_ixc_recebivel_not_blank CHECK (btrim(ixc_recebivel_id) <> ''),
  CONSTRAINT ixc_recebiveis_raw_ixc_cliente_not_blank CHECK (btrim(ixc_cliente_id) <> ''),
  CONSTRAINT ixc_recebiveis_raw_hash_not_blank CHECK (btrim(hash_payload) <> ''),
  CONSTRAINT ixc_recebiveis_raw_valor_non_negative CHECK (valor IS NULL OR valor >= 0),
  CONSTRAINT ixc_recebiveis_raw_valor_recebido_positive CHECK (valor_recebido > 0),
  CONSTRAINT ixc_recebiveis_raw_unique UNIQUE (tenant_id, ixc_connection_id, ixc_recebivel_id)
);

CREATE INDEX IF NOT EXISTS ixc_recebiveis_raw_tenant_cliente_pagamento_idx
  ON public.ixc_recebiveis_raw (tenant_id, ixc_cliente_id, data_pagamento DESC);

CREATE INDEX IF NOT EXISTS ixc_recebiveis_raw_tenant_sync_idx
  ON public.ixc_recebiveis_raw (tenant_id, ultimo_sync_em DESC);

CREATE INDEX IF NOT EXISTS ixc_recebiveis_raw_tenant_ixc_updated_idx
  ON public.ixc_recebiveis_raw (tenant_id, ultima_atualizacao_ixc DESC);

CREATE INDEX IF NOT EXISTS ixc_recebiveis_raw_pending_points_idx
  ON public.ixc_recebiveis_raw (tenant_id, data_pagamento DESC)
  WHERE processado_pontuacao = false AND status = 'R';

CREATE INDEX IF NOT EXISTS ixc_recebiveis_raw_tenant_contrato_idx
  ON public.ixc_recebiveis_raw (tenant_id, ixc_contrato_id)
  WHERE ixc_contrato_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at_ixc_recebiveis_raw ON public.ixc_recebiveis_raw;
CREATE TRIGGER set_updated_at_ixc_recebiveis_raw
BEFORE UPDATE ON public.ixc_recebiveis_raw
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- Incremental sync state / watermark
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pontuacao_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ixc_connection_id uuid NOT NULL REFERENCES public.ixc_connections(id) ON DELETE CASCADE,
  sync_tipo text NOT NULL,
  watermark_utc timestamptz,
  watermark_ref text,
  last_success_at timestamptz,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'success', 'error')),
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pontuacao_sync_state_sync_tipo_not_blank CHECK (btrim(sync_tipo) <> ''),
  CONSTRAINT pontuacao_sync_state_unique UNIQUE (tenant_id, ixc_connection_id, sync_tipo)
);

CREATE INDEX IF NOT EXISTS pontuacao_sync_state_tenant_status_idx
  ON public.pontuacao_sync_state (tenant_id, status, updated_at DESC);

DROP TRIGGER IF EXISTS set_updated_at_pontuacao_sync_state ON public.pontuacao_sync_state;
CREATE TRIGGER set_updated_at_pontuacao_sync_state
BEFORE UPDATE ON public.pontuacao_sync_state
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- Points ledger (gain/loss history)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pontuacao_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campanha_cliente_id uuid REFERENCES public.pontuacao_campanha_clientes(id) ON DELETE SET NULL,
  ixc_cliente_id text NOT NULL,
  tipo_movimento text NOT NULL CHECK (tipo_movimento IN ('credito', 'debito', 'ajuste', 'estorno')),
  origem text NOT NULL,
  pontos integer NOT NULL CHECK (pontos <> 0),
  descricao text,
  referencia_externa_tipo text,
  referencia_externa_id text,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pontuacao_movimentos_ixc_cliente_not_blank CHECK (btrim(ixc_cliente_id) <> ''),
  CONSTRAINT pontuacao_movimentos_origem_not_blank CHECK (btrim(origem) <> ''),
  CONSTRAINT pontuacao_movimentos_idempotency_not_blank CHECK (btrim(idempotency_key) <> ''),
  CONSTRAINT pontuacao_movimentos_tenant_idempotency_key UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT pontuacao_movimentos_tipo_sinal CHECK (
    (tipo_movimento IN ('credito', 'estorno') AND pontos > 0)
    OR (tipo_movimento = 'debito' AND pontos < 0)
    OR (tipo_movimento = 'ajuste')
  )
);

CREATE INDEX IF NOT EXISTS pontuacao_movimentos_tenant_cliente_created_idx
  ON public.pontuacao_movimentos (tenant_id, ixc_cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pontuacao_movimentos_tenant_origem_created_idx
  ON public.pontuacao_movimentos (tenant_id, origem, created_at DESC);

CREATE INDEX IF NOT EXISTS pontuacao_movimentos_tenant_referencia_idx
  ON public.pontuacao_movimentos (tenant_id, referencia_externa_tipo, referencia_externa_id)
  WHERE referencia_externa_tipo IS NOT NULL AND referencia_externa_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Points balances projection (fast reads)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pontuacao_saldos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campanha_cliente_id uuid REFERENCES public.pontuacao_campanha_clientes(id) ON DELETE SET NULL,
  ixc_cliente_id text NOT NULL,
  pontos_credito integer NOT NULL DEFAULT 0 CHECK (pontos_credito >= 0),
  pontos_debito integer NOT NULL DEFAULT 0 CHECK (pontos_debito >= 0),
  saldo integer NOT NULL DEFAULT 0,
  ultimo_movimento_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pontuacao_saldos_ixc_cliente_not_blank CHECK (btrim(ixc_cliente_id) <> ''),
  CONSTRAINT pontuacao_saldos_unique_cliente UNIQUE (tenant_id, ixc_cliente_id),
  CONSTRAINT pontuacao_saldos_consistency CHECK (saldo = pontos_credito - pontos_debito)
);

CREATE INDEX IF NOT EXISTS pontuacao_saldos_tenant_saldo_idx
  ON public.pontuacao_saldos (tenant_id, saldo DESC);

CREATE INDEX IF NOT EXISTS pontuacao_saldos_tenant_ultimo_movimento_idx
  ON public.pontuacao_saldos (tenant_id, ultimo_movimento_em DESC);

DROP TRIGGER IF EXISTS set_updated_at_pontuacao_saldos ON public.pontuacao_saldos;
CREATE TRIGGER set_updated_at_pontuacao_saldos
BEFORE UPDATE ON public.pontuacao_saldos
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Optional linkage from redemption to ledger movement (safe additive change)
ALTER TABLE public.pontuacao_resgates
  ADD COLUMN IF NOT EXISTS movimento_id uuid REFERENCES public.pontuacao_movimentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pontuacao_resgates_movimento_idx
  ON public.pontuacao_resgates (movimento_id)
  WHERE movimento_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- RLS for new tables
-- ---------------------------------------------------------------------
ALTER TABLE public.ixc_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ixc_recebiveis_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_saldos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ixc_clientes' AND policyname = 'ixc_clientes_select'
  ) THEN
    CREATE POLICY ixc_clientes_select
      ON public.ixc_clientes
      FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.tenant_id = ixc_clientes.tenant_id
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ixc_recebiveis_raw' AND policyname = 'ixc_recebiveis_raw_select'
  ) THEN
    CREATE POLICY ixc_recebiveis_raw_select
      ON public.ixc_recebiveis_raw
      FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.tenant_id = ixc_recebiveis_raw.tenant_id
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pontuacao_sync_state' AND policyname = 'pontuacao_sync_state_select'
  ) THEN
    CREATE POLICY pontuacao_sync_state_select
      ON public.pontuacao_sync_state
      FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.tenant_id = pontuacao_sync_state.tenant_id
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pontuacao_movimentos' AND policyname = 'pontuacao_movimentos_select'
  ) THEN
    CREATE POLICY pontuacao_movimentos_select
      ON public.pontuacao_movimentos
      FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.tenant_id = pontuacao_movimentos.tenant_id
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pontuacao_saldos' AND policyname = 'pontuacao_saldos_select'
  ) THEN
    CREATE POLICY pontuacao_saldos_select
      ON public.pontuacao_saldos
      FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.tenant_id = pontuacao_saldos.tenant_id
      ));
  END IF;
END $$;
