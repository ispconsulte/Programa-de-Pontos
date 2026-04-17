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
  ALTER COLUMN ixc_cliente_id DROP NOT NULL;

ALTER TABLE public.pontuacao_resgates
  ADD COLUMN IF NOT EXISTS contato_id uuid REFERENCES public.pontuacao_contatos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_destinatario text NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS destinatario_nome text,
  ADD COLUMN IF NOT EXISTS destinatario_telefone text;

ALTER TABLE public.pontuacao_historico
  ALTER COLUMN ixc_cliente_id DROP NOT NULL;

ALTER TABLE public.pontuacao_historico
  ADD COLUMN IF NOT EXISTS contato_id uuid REFERENCES public.pontuacao_contatos(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.register_legacy_redemption(
  p_tenant_id uuid,
  p_client_id uuid DEFAULT NULL,
  p_reward_id uuid DEFAULT NULL,
  p_responsible text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_is_active_customer boolean DEFAULT true,
  p_lead_name text DEFAULT NULL,
  p_lead_phone text DEFAULT NULL
)
RETURNS TABLE (
  redemption jsonb,
  remaining_points integer,
  remaining_stock integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client public.pontuacao_campanha_clientes%ROWTYPE;
  v_reward public.pontuacao_catalogo_brindes%ROWTYPE;
  v_redemption public.pontuacao_resgates%ROWTYPE;
  v_contact_id uuid;
  v_delivered_at timestamptz := now();
  v_spent_points integer;
  v_remaining_stock integer;
  v_target_name text;
  v_target_phone text;
BEGIN
  IF p_reward_id IS NULL THEN
    RAISE EXCEPTION 'Brinde não encontrado';
  END IF;

  IF p_is_active_customer THEN
    SELECT *
    INTO v_client
    FROM public.pontuacao_campanha_clientes
    WHERE tenant_id = p_tenant_id
      AND id = p_client_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente não encontrado';
    END IF;

    IF coalesce(nullif(lower(v_client.status_campanha), ''), 'ativo') <> 'ativo' THEN
      RAISE EXCEPTION 'O cliente está inativo para resgates';
    END IF;

    v_target_name := coalesce(nullif(btrim(v_client.nome_cliente), ''), 'Cliente');
    v_target_phone := nullif(btrim(coalesce(v_client.telefone, v_client.telefone_cliente, '')), '');
  ELSE
    IF nullif(btrim(coalesce(p_lead_name, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Nome é obrigatório para não cliente';
    END IF;

    IF nullif(btrim(coalesce(p_lead_phone, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Telefone é obrigatório para não cliente';
    END IF;

    v_target_name := btrim(p_lead_name);
    v_target_phone := btrim(p_lead_phone);

    INSERT INTO public.pontuacao_contatos (
      tenant_id,
      nome,
      telefone,
      origem,
      metadata
    )
    VALUES (
      p_tenant_id,
      v_target_name,
      v_target_phone,
      'resgate',
      jsonb_build_object('created_from', 'reward_redemption_modal', 'candidate_type', 'lead')
    )
    ON CONFLICT (tenant_id, telefone)
    DO UPDATE SET
      nome = EXCLUDED.nome,
      origem = EXCLUDED.origem,
      metadata = public.pontuacao_contatos.metadata || EXCLUDED.metadata,
      updated_at = now()
    RETURNING id
    INTO v_contact_id;
  END IF;

  SELECT *
  INTO v_reward
  FROM public.pontuacao_catalogo_brindes
  WHERE id = p_reward_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Brinde não encontrado';
  END IF;

  IF coalesce(v_reward.ativo, false) = false THEN
    RAISE EXCEPTION 'O brinde está inativo';
  END IF;

  v_spent_points := coalesce(v_reward.pontos_necessarios, 0);
  IF p_is_active_customer AND coalesce(v_client.pontos_disponiveis, 0) < v_spent_points THEN
    RAISE EXCEPTION 'O cliente não possui pontos suficientes';
  END IF;

  IF v_reward.estoque IS NOT NULL AND v_reward.estoque <= 0 THEN
    RAISE EXCEPTION 'O brinde está sem estoque';
  END IF;

  IF p_is_active_customer THEN
    UPDATE public.pontuacao_campanha_clientes
    SET
      pontos_resgatados = coalesce(pontos_resgatados, 0) + v_spent_points,
      ultimo_resgate = v_delivered_at,
      ultima_sincronizacao_em = v_delivered_at
    WHERE id = v_client.id;
  END IF;

  IF v_reward.estoque IS NULL THEN
    v_remaining_stock := NULL;
  ELSE
    UPDATE public.pontuacao_catalogo_brindes
    SET estoque = estoque - 1
    WHERE id = v_reward.id;

    v_remaining_stock := GREATEST(v_reward.estoque - 1, 0);
  END IF;

  INSERT INTO public.pontuacao_resgates (
    ixc_cliente_id,
    contato_id,
    tenant_id,
    brinde_id,
    brinde_nome,
    pontos_utilizados,
    status_resgate,
    data_entrega,
    responsavel_entrega,
    observacoes,
    confirmacao_cliente,
    tipo_destinatario,
    destinatario_nome,
    destinatario_telefone
  )
  VALUES (
    CASE WHEN p_is_active_customer THEN v_client.ixc_cliente_id ELSE NULL END,
    v_contact_id,
    p_tenant_id,
    v_reward.id,
    v_reward.nome,
    v_spent_points,
    'entregue',
    v_delivered_at,
    nullif(btrim(coalesce(p_responsible, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    true,
    CASE WHEN p_is_active_customer THEN 'cliente' ELSE 'contato' END,
    v_target_name,
    v_target_phone
  )
  RETURNING *
  INTO v_redemption;

  INSERT INTO public.pontuacao_historico (
    tenant_id,
    ixc_cliente_id,
    contato_id,
    tipo_evento,
    pontos,
    descricao,
    criado_por
  )
  VALUES (
    p_tenant_id,
    CASE WHEN p_is_active_customer THEN v_client.ixc_cliente_id ELSE NULL END,
    v_contact_id,
    'resgate',
    CASE WHEN p_is_active_customer THEN -v_spent_points ELSE 0 END,
    format('Resgate do brinde %s', v_reward.nome),
    coalesce(nullif(btrim(coalesce(p_responsible, '')), ''), 'operacao')
  );

  redemption := to_jsonb(v_redemption);
  remaining_points := CASE
    WHEN p_is_active_customer THEN coalesce(v_client.pontos_disponiveis, 0) - v_spent_points
    ELSE NULL
  END;
  remaining_stock := v_remaining_stock;
  RETURN NEXT;
END;
$$;
