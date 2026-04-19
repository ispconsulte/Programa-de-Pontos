CREATE TABLE IF NOT EXISTS public.pontuacao_ajustes_manuais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.pontuacao_campanha_clientes(id) ON DELETE CASCADE,
  ixc_cliente_id text NOT NULL,
  customer_name_snapshot text NOT NULL,
  customer_document_snapshot text,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('credit', 'debit')),
  points integer NOT NULL CHECK (points > 0),
  reason text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  actor_name_snapshot text NOT NULL,
  previous_balance integer NOT NULL CHECK (previous_balance >= 0),
  new_balance integer NOT NULL CHECK (new_balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pontuacao_ajustes_manuais_tenant_cliente_idx
  ON public.pontuacao_ajustes_manuais (tenant_id, ixc_cliente_id, created_at DESC);

ALTER TABLE public.pontuacao_ajustes_manuais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_ajustes_manuais FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pontuacao_ajustes_manuais'
      AND policyname = 'pontuacao_ajustes_manuais_admin_select'
  ) THEN
    CREATE POLICY pontuacao_ajustes_manuais_admin_select
    ON public.pontuacao_ajustes_manuais
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.tenant_id = pontuacao_ajustes_manuais.tenant_id
          AND u.is_active = true
      )
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.apply_manual_points_adjustment(
  p_tenant_id uuid,
  p_client_id uuid,
  p_actor_user_id uuid,
  p_actor_name text,
  p_adjustment_type text,
  p_points integer,
  p_reason text,
  p_customer_name_snapshot text,
  p_customer_document_snapshot text DEFAULT NULL
)
RETURNS TABLE (
  accumulated_points integer,
  redeemed_points integer,
  new_balance integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client public.pontuacao_campanha_clientes%ROWTYPE;
  v_delta integer;
  v_next_accumulated integer;
  v_next_redeemed integer;
  v_previous_balance integer;
  v_new_balance integer;
BEGIN
  IF p_points IS NULL OR p_points <= 0 THEN
    RAISE EXCEPTION 'A quantidade de pontos deve ser maior que zero';
  END IF;

  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'O motivo do ajuste manual é obrigatório';
  END IF;

  IF nullif(btrim(coalesce(p_actor_name, '')), '') IS NULL OR p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'O usuário autenticado é obrigatório para ajustes manuais';
  END IF;

  IF p_adjustment_type NOT IN ('credit', 'debit') THEN
    RAISE EXCEPTION 'Tipo de ajuste manual inválido';
  END IF;

  SELECT *
  INTO v_client
  FROM public.pontuacao_campanha_clientes
  WHERE tenant_id = p_tenant_id
    AND id = p_client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  v_previous_balance := GREATEST(coalesce(v_client.pontos_acumulados, 0) - coalesce(v_client.pontos_resgatados, 0), 0);
  v_delta := CASE WHEN p_adjustment_type = 'debit' THEN -p_points ELSE p_points END;
  v_next_accumulated := coalesce(v_client.pontos_acumulados, 0) + v_delta;
  v_next_redeemed := coalesce(v_client.pontos_resgatados, 0);
  v_new_balance := v_next_accumulated - v_next_redeemed;

  IF v_next_accumulated < v_next_redeemed OR v_new_balance < 0 THEN
    RAISE EXCEPTION 'O débito manual excede o saldo disponível do cliente';
  END IF;

  UPDATE public.pontuacao_campanha_clientes
  SET
    pontos_acumulados = v_next_accumulated,
    ultima_sincronizacao_em = now()
  WHERE id = v_client.id;

  INSERT INTO public.pontuacao_historico (
    tenant_id,
    ixc_cliente_id,
    tipo_evento,
    pontos,
    descricao,
    criado_por
  )
  VALUES (
    p_tenant_id,
    v_client.ixc_cliente_id,
    'ajuste_manual',
    v_delta,
    btrim(p_reason),
    p_actor_user_id::text
  );

  INSERT INTO public.pontuacao_ajustes_manuais (
    tenant_id,
    client_id,
    ixc_cliente_id,
    customer_name_snapshot,
    customer_document_snapshot,
    adjustment_type,
    points,
    reason,
    actor_user_id,
    actor_name_snapshot,
    previous_balance,
    new_balance
  )
  VALUES (
    p_tenant_id,
    v_client.id,
    v_client.ixc_cliente_id,
    coalesce(nullif(btrim(coalesce(p_customer_name_snapshot, '')), ''), coalesce(nullif(btrim(coalesce(v_client.nome_cliente, '')), ''), 'Cliente')),
    nullif(btrim(coalesce(p_customer_document_snapshot, v_client.documento, '')), ''),
    p_adjustment_type,
    p_points,
    btrim(p_reason),
    p_actor_user_id,
    btrim(p_actor_name),
    v_previous_balance,
    v_new_balance
  );

  accumulated_points := v_next_accumulated;
  redeemed_points := v_next_redeemed;
  new_balance := v_new_balance;
  RETURN NEXT;
END;
$$;
