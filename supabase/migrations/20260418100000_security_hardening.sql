CREATE TABLE IF NOT EXISTS public.pontuacao_mutation_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope text NOT NULL,
  idempotency_key text NOT NULL,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pontuacao_mutation_idempotency_scope_not_blank CHECK (btrim(scope) <> ''),
  CONSTRAINT pontuacao_mutation_idempotency_key_not_blank CHECK (btrim(idempotency_key) <> ''),
  CONSTRAINT pontuacao_mutation_idempotency_unique UNIQUE (tenant_id, scope, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.pontuacao_operational_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  reason text,
  old_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  success boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pontuacao_operational_audit_logs_action_not_blank CHECK (btrim(action) <> ''),
  CONSTRAINT pontuacao_operational_audit_logs_entity_type_not_blank CHECK (btrim(entity_type) <> '')
);

CREATE RULE no_update_pontuacao_operational_audit_logs AS
ON UPDATE TO public.pontuacao_operational_audit_logs DO INSTEAD NOTHING;

CREATE RULE no_delete_pontuacao_operational_audit_logs AS
ON DELETE TO public.pontuacao_operational_audit_logs DO INSTEAD NOTHING;

CREATE INDEX IF NOT EXISTS pontuacao_operational_audit_logs_tenant_created_idx
  ON public.pontuacao_operational_audit_logs (tenant_id, created_at DESC);

ALTER TABLE public.pontuacao_operational_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_operational_audit_logs FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pontuacao_operational_audit_logs'
      AND policyname = 'pontuacao_operational_audit_logs_admin_select'
  ) THEN
    CREATE POLICY pontuacao_operational_audit_logs_admin_select
    ON public.pontuacao_operational_audit_logs
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.tenant_id = pontuacao_operational_audit_logs.tenant_id
          AND u.is_active = true
          AND u.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text])
      )
    );
  END IF;
END $$;

ALTER TABLE public.pontuacao_catalogo_brindes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_reason text;

ALTER TABLE public.pontuacao_resgates
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_reason text;

CREATE OR REPLACE FUNCTION public.write_operational_audit_log(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_old_values jsonb DEFAULT '{}'::jsonb,
  p_new_values jsonb DEFAULT '{}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_success boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor public.users%ROWTYPE;
BEGIN
  SELECT *
  INTO v_actor
  FROM public.users
  WHERE id = p_actor_user_id;

  INSERT INTO public.pontuacao_operational_audit_logs (
    tenant_id,
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    reason,
    old_values,
    new_values,
    metadata,
    success
  )
  VALUES (
    p_tenant_id,
    p_actor_user_id,
    CASE WHEN FOUND THEN v_actor.role ELSE NULL END,
    p_action,
    p_entity_type,
    p_entity_id,
    nullif(btrim(coalesce(p_reason, '')), ''),
    coalesce(p_old_values, '{}'::jsonb),
    coalesce(p_new_values, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_success, true)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_item_secure_upsert(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_required_points integer DEFAULT NULL,
  p_stock integer DEFAULT NULL,
  p_image_url text DEFAULT NULL,
  p_active boolean DEFAULT true,
  p_expected_updated_at timestamptz DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor public.users%ROWTYPE;
  v_existing_response jsonb;
  v_current public.pontuacao_catalogo_brindes%ROWTYPE;
  v_result public.pontuacao_catalogo_brindes%ROWTYPE;
  v_scope text := CASE WHEN p_id IS NULL THEN 'catalog_create' ELSE 'catalog_update' END;
BEGIN
  IF nullif(btrim(coalesce(p_idempotency_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Idempotency key é obrigatória';
  END IF;

  IF p_required_points IS NULL OR p_required_points <= 0 THEN
    RAISE EXCEPTION 'Pontuação obrigatória inválida';
  END IF;

  IF p_stock IS NOT NULL AND p_stock < 0 THEN
    RAISE EXCEPTION 'Estoque inválido';
  END IF;

  SELECT *
  INTO v_actor
  FROM public.users
  WHERE id = p_actor_user_id
    AND tenant_id = p_tenant_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário autenticado não encontrado';
  END IF;

  IF v_actor.role <> ALL (ARRAY['admin'::text, 'owner'::text, 'manager'::text]) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text || ':' || v_scope || ':' || p_idempotency_key));

  SELECT response_payload
  INTO v_existing_response
  FROM public.pontuacao_mutation_idempotency
  WHERE tenant_id = p_tenant_id
    AND scope = v_scope
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN v_existing_response;
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.pontuacao_catalogo_brindes (
      tenant_id,
      nome,
      descricao,
      pontos_necessarios,
      estoque,
      imagem_url,
      ativo
    )
    VALUES (
      p_tenant_id,
      btrim(coalesce(p_name, '')),
      nullif(btrim(coalesce(p_description, '')), ''),
      p_required_points,
      p_stock,
      nullif(btrim(coalesce(p_image_url, '')), ''),
      coalesce(p_active, true)
    )
    RETURNING *
    INTO v_result;

    PERFORM public.write_operational_audit_log(
      p_tenant_id,
      p_actor_user_id,
      'catalog.create',
      'catalog_item',
      v_result.id::text,
      p_reason,
      '{}'::jsonb,
      to_jsonb(v_result)
    );
  ELSE
    SELECT *
    INTO v_current
    FROM public.pontuacao_catalogo_brindes
    WHERE tenant_id = p_tenant_id
      AND id = p_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Brinde não encontrado';
    END IF;

    IF p_expected_updated_at IS NOT NULL AND v_current.updated_at <> p_expected_updated_at THEN
      RAISE EXCEPTION 'Registro desatualizado. Recarregue antes de salvar.';
    END IF;

    UPDATE public.pontuacao_catalogo_brindes
    SET
      nome = btrim(coalesce(p_name, v_current.nome)),
      descricao = nullif(btrim(coalesce(p_description, v_current.descricao, '')), ''),
      pontos_necessarios = p_required_points,
      estoque = p_stock,
      imagem_url = nullif(btrim(coalesce(p_image_url, v_current.imagem_url, '')), ''),
      ativo = coalesce(p_active, v_current.ativo)
    WHERE id = v_current.id
    RETURNING *
    INTO v_result;

    PERFORM public.write_operational_audit_log(
      p_tenant_id,
      p_actor_user_id,
      CASE WHEN coalesce(v_current.estoque, -1) IS DISTINCT FROM coalesce(v_result.estoque, -1) THEN 'catalog.stock_update' ELSE 'catalog.update' END,
      'catalog_item',
      v_result.id::text,
      p_reason,
      to_jsonb(v_current),
      to_jsonb(v_result)
    );
  END IF;

  v_existing_response := to_jsonb(v_result);

  INSERT INTO public.pontuacao_mutation_idempotency (
    tenant_id,
    scope,
    idempotency_key,
    response_payload
  )
  VALUES (
    p_tenant_id,
    v_scope,
    p_idempotency_key,
    v_existing_response
  );

  RETURN v_existing_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_item_secure_soft_delete(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_id uuid,
  p_expected_updated_at timestamptz DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor public.users%ROWTYPE;
  v_existing_response jsonb;
  v_current public.pontuacao_catalogo_brindes%ROWTYPE;
  v_result public.pontuacao_catalogo_brindes%ROWTYPE;
BEGIN
  IF nullif(btrim(coalesce(p_idempotency_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Idempotency key é obrigatória';
  END IF;

  SELECT *
  INTO v_actor
  FROM public.users
  WHERE id = p_actor_user_id
    AND tenant_id = p_tenant_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário autenticado não encontrado';
  END IF;

  IF v_actor.role <> ALL (ARRAY['admin'::text, 'owner'::text, 'manager'::text]) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text || ':catalog_delete:' || p_idempotency_key));

  SELECT response_payload
  INTO v_existing_response
  FROM public.pontuacao_mutation_idempotency
  WHERE tenant_id = p_tenant_id
    AND scope = 'catalog_delete'
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN v_existing_response;
  END IF;

  SELECT *
  INTO v_current
  FROM public.pontuacao_catalogo_brindes
  WHERE tenant_id = p_tenant_id
    AND id = p_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Brinde não encontrado';
  END IF;

  IF p_expected_updated_at IS NOT NULL AND v_current.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'Registro desatualizado. Recarregue antes de excluir.';
  END IF;

  UPDATE public.pontuacao_catalogo_brindes
  SET
    ativo = false,
    deleted_at = now(),
    deleted_by = p_actor_user_id,
    deleted_reason = nullif(btrim(coalesce(p_reason, '')), '')
  WHERE id = v_current.id
  RETURNING *
  INTO v_result;

  v_existing_response := to_jsonb(v_result);

  INSERT INTO public.pontuacao_mutation_idempotency (
    tenant_id,
    scope,
    idempotency_key,
    response_payload
  )
  VALUES (
    p_tenant_id,
    'catalog_delete',
    p_idempotency_key,
    v_existing_response
  );

  PERFORM public.write_operational_audit_log(
    p_tenant_id,
    p_actor_user_id,
    'catalog.delete',
    'catalog_item',
    v_result.id::text,
    p_reason,
    to_jsonb(v_current),
    to_jsonb(v_result)
  );

  RETURN v_existing_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_manual_points_adjustment(
  p_tenant_id uuid,
  p_client_id uuid,
  p_actor_user_id uuid,
  p_actor_name text,
  p_adjustment_type text,
  p_points integer,
  p_reason text,
  p_customer_name_snapshot text,
  p_customer_document_snapshot text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
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
  v_actor public.users%ROWTYPE;
  v_delta integer;
  v_next_accumulated integer;
  v_next_redeemed integer;
  v_previous_balance integer;
  v_new_balance integer;
  v_existing_response jsonb;
  v_recent_adjustments integer;
BEGIN
  IF nullif(btrim(coalesce(p_idempotency_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Idempotency key é obrigatória';
  END IF;

  IF p_points IS NULL OR p_points <= 0 THEN
    RAISE EXCEPTION 'A quantidade de pontos deve ser maior que zero';
  END IF;

  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'O motivo do ajuste manual é obrigatório';
  END IF;

  SELECT *
  INTO v_actor
  FROM public.users
  WHERE id = p_actor_user_id
    AND tenant_id = p_tenant_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'O usuário autenticado é obrigatório para ajustes manuais';
  END IF;

  IF v_actor.role <> ALL (ARRAY['admin'::text, 'owner'::text, 'manager'::text]) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_adjustment_type NOT IN ('credit', 'debit') THEN
    RAISE EXCEPTION 'Tipo de ajuste manual inválido';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text || ':manual_points:' || p_idempotency_key));

  SELECT response_payload
  INTO v_existing_response
  FROM public.pontuacao_mutation_idempotency
  WHERE tenant_id = p_tenant_id
    AND scope = 'manual_points_adjustment'
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    accumulated_points := COALESCE((v_existing_response ->> 'accumulated_points')::integer, 0);
    redeemed_points := COALESCE((v_existing_response ->> 'redeemed_points')::integer, 0);
    new_balance := COALESCE((v_existing_response ->> 'new_balance')::integer, 0);
    RETURN NEXT;
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

  INSERT INTO public.pontuacao_mutation_idempotency (
    tenant_id,
    scope,
    idempotency_key,
    response_payload
  )
  VALUES (
    p_tenant_id,
    'manual_points_adjustment',
    p_idempotency_key,
    jsonb_build_object(
      'accumulated_points', v_next_accumulated,
      'redeemed_points', v_next_redeemed,
      'new_balance', v_new_balance
    )
  );

  PERFORM public.write_operational_audit_log(
    p_tenant_id,
    p_actor_user_id,
    CASE WHEN p_adjustment_type = 'debit' THEN 'points.manual_debit' ELSE 'points.manual_credit' END,
    'campaign_client',
    v_client.id::text,
    p_reason,
    jsonb_build_object(
      'points_acumulados', v_client.pontos_acumulados,
      'pontos_resgatados', v_client.pontos_resgatados,
      'balance', v_previous_balance
    ),
    jsonb_build_object(
      'points_acumulados', v_next_accumulated,
      'pontos_resgatados', v_next_redeemed,
      'balance', v_new_balance
    )
  );

  SELECT COUNT(*)
  INTO v_recent_adjustments
  FROM public.pontuacao_ajustes_manuais
  WHERE tenant_id = p_tenant_id
    AND actor_user_id = p_actor_user_id
    AND created_at >= (now() - interval '10 minutes');

  IF v_recent_adjustments >= 5 THEN
    PERFORM public.write_operational_audit_log(
      p_tenant_id,
      p_actor_user_id,
      'security.anomaly.manual_points_frequency',
      'campaign_client',
      v_client.id::text,
      p_reason,
      '{}'::jsonb,
      jsonb_build_object('recentAdjustments', v_recent_adjustments),
      jsonb_build_object('adjustmentType', p_adjustment_type),
      true
    );
  END IF;

  accumulated_points := v_next_accumulated;
  redeemed_points := v_next_redeemed;
  new_balance := v_new_balance;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_legacy_redemption(
  p_tenant_id uuid,
  p_client_id uuid DEFAULT NULL,
  p_reward_id uuid DEFAULT NULL,
  p_responsible text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_is_active_customer boolean DEFAULT true,
  p_lead_name text DEFAULT NULL,
  p_lead_phone text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL,
  p_quantity integer DEFAULT 1,
  p_idempotency_key text DEFAULT NULL
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
  v_actor public.users%ROWTYPE;
  v_client public.pontuacao_campanha_clientes%ROWTYPE;
  v_reward public.pontuacao_catalogo_brindes%ROWTYPE;
  v_redemption public.pontuacao_resgates%ROWTYPE;
  v_contact_id uuid;
  v_existing_response jsonb;
  v_event_at timestamptz := now();
  v_spent_points integer;
  v_remaining_stock integer;
  v_target_name text;
  v_target_phone text;
  v_is_admin boolean;
BEGIN
  IF nullif(btrim(coalesce(p_idempotency_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Idempotency key é obrigatória';
  END IF;

  IF p_reward_id IS NULL THEN
    RAISE EXCEPTION 'Brinde não encontrado';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  SELECT *
  INTO v_actor
  FROM public.users
  WHERE id = p_actor_user_id
    AND tenant_id = p_tenant_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário autenticado não encontrado';
  END IF;

  v_is_admin := v_actor.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text]);

  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text || ':legacy_redemption_create:' || p_idempotency_key));

  SELECT response_payload
  INTO v_existing_response
  FROM public.pontuacao_mutation_idempotency
  WHERE tenant_id = p_tenant_id
    AND scope = 'legacy_redemption_create'
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    redemption := v_existing_response -> 'redemption';
    remaining_points := CASE WHEN (v_existing_response ? 'remaining_points') THEN (v_existing_response ->> 'remaining_points')::integer ELSE NULL END;
    remaining_stock := CASE WHEN (v_existing_response ? 'remaining_stock') THEN (v_existing_response ->> 'remaining_stock')::integer ELSE NULL END;
    RETURN NEXT;
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
  WHERE tenant_id = p_tenant_id
    AND id = p_reward_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Brinde não encontrado';
  END IF;

  IF coalesce(v_reward.ativo, false) = false THEN
    RAISE EXCEPTION 'O brinde está inativo';
  END IF;

  v_spent_points := coalesce(v_reward.pontos_necessarios, 0) * p_quantity;
  IF p_is_active_customer AND v_is_admin AND coalesce(v_client.pontos_disponiveis, 0) < v_spent_points THEN
    RAISE EXCEPTION 'O cliente não possui pontos suficientes';
  END IF;

  IF v_reward.estoque IS NOT NULL AND v_reward.estoque < p_quantity THEN
    RAISE EXCEPTION 'O brinde está sem estoque';
  END IF;

  IF v_is_admin AND p_is_active_customer THEN
    UPDATE public.pontuacao_campanha_clientes
    SET
      pontos_resgatados = coalesce(pontos_resgatados, 0) + v_spent_points,
      ultimo_resgate = v_event_at,
      ultima_sincronizacao_em = v_event_at
    WHERE id = v_client.id;
  END IF;

  IF v_is_admin AND v_reward.estoque IS NOT NULL THEN
    UPDATE public.pontuacao_catalogo_brindes
    SET estoque = estoque - p_quantity
    WHERE id = v_reward.id;

    v_remaining_stock := GREATEST(v_reward.estoque - p_quantity, 0);
  ELSE
    v_remaining_stock := CASE WHEN v_reward.estoque IS NULL THEN NULL ELSE v_reward.estoque END;
  END IF;

  INSERT INTO public.pontuacao_resgates (
    ixc_cliente_id,
    contato_id,
    tenant_id,
    brinde_id,
    brinde_nome,
    pontos_utilizados,
    quantity,
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
    p_quantity,
    CASE WHEN v_is_admin THEN 'entregue' ELSE 'pendente' END,
    CASE WHEN v_is_admin THEN v_event_at ELSE NULL END,
    nullif(btrim(coalesce(p_responsible, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    CASE WHEN v_is_admin THEN true ELSE false END,
    CASE WHEN p_is_active_customer THEN 'cliente' ELSE 'contato' END,
    v_target_name,
    v_target_phone
  )
  RETURNING *
  INTO v_redemption;

  IF v_is_admin THEN
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
      format('Resgate do brinde %s (x%s)', v_reward.nome, p_quantity),
      p_actor_user_id::text
    );
  END IF;

  redemption := to_jsonb(v_redemption);
  remaining_points := CASE
    WHEN p_is_active_customer AND v_is_admin THEN coalesce(v_client.pontos_disponiveis, 0) - v_spent_points
    WHEN p_is_active_customer THEN coalesce(v_client.pontos_disponiveis, 0)
    ELSE NULL
  END;
  remaining_stock := v_remaining_stock;

  INSERT INTO public.pontuacao_mutation_idempotency (
    tenant_id,
    scope,
    idempotency_key,
    response_payload
  )
  VALUES (
    p_tenant_id,
    'legacy_redemption_create',
    p_idempotency_key,
    jsonb_build_object(
      'redemption', redemption,
      'remaining_points', remaining_points,
      'remaining_stock', remaining_stock
    )
  );

  PERFORM public.write_operational_audit_log(
    p_tenant_id,
    p_actor_user_id,
    CASE WHEN v_is_admin THEN 'rescue.create_confirmed' ELSE 'rescue.create_pending' END,
    'legacy_redemption',
    v_redemption.id::text,
    p_notes,
    '{}'::jsonb,
    jsonb_build_object(
      'status_resgate', v_redemption.status_resgate,
      'quantity', v_redemption.quantity,
      'brinde_id', v_redemption.brinde_id,
      'ixc_cliente_id', v_redemption.ixc_cliente_id,
      'contato_id', v_redemption.contato_id,
      'pontos_utilizados', v_redemption.pontos_utilizados
    ),
    jsonb_build_object('responsible', nullif(btrim(coalesce(p_responsible, '')), ''))
  );

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.mutate_legacy_redemption(
  p_tenant_id uuid,
  p_redemption_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_responsible text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor public.users%ROWTYPE;
  v_redemption public.pontuacao_resgates%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_client public.pontuacao_campanha_clientes%ROWTYPE;
  v_reward public.pontuacao_catalogo_brindes%ROWTYPE;
  v_existing_response jsonb;
  v_is_admin boolean;
  v_points_to_revert integer;
BEGIN
  IF nullif(btrim(coalesce(p_idempotency_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Idempotency key é obrigatória';
  END IF;

  IF p_action NOT IN ('confirm', 'cancel', 'delete', 'edit') THEN
    RAISE EXCEPTION 'Ação de resgate inválida';
  END IF;

  SELECT *
  INTO v_actor
  FROM public.users
  WHERE id = p_actor_user_id
    AND tenant_id = p_tenant_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário autenticado não encontrado';
  END IF;

  v_is_admin := v_actor.role = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text]);
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text || ':legacy_redemption_' || p_action || ':' || p_idempotency_key));

  SELECT response_payload
  INTO v_existing_response
  FROM public.pontuacao_mutation_idempotency
  WHERE tenant_id = p_tenant_id
    AND scope = 'legacy_redemption_' || p_action
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN v_existing_response;
  END IF;

  SELECT *
  INTO v_redemption
  FROM public.pontuacao_resgates
  WHERE tenant_id = p_tenant_id
    AND id = p_redemption_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resgate não encontrado';
  END IF;

  IF p_expected_updated_at IS NOT NULL AND v_redemption.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'Registro desatualizado. Recarregue antes de alterar.';
  END IF;

  v_before := to_jsonb(v_redemption);

  IF p_action = 'confirm' THEN
    IF v_redemption.status_resgate <> 'pendente' THEN
      RAISE EXCEPTION 'Transição de status inválida';
    END IF;

    SELECT *
    INTO v_reward
    FROM public.pontuacao_catalogo_brindes
    WHERE tenant_id = p_tenant_id
      AND id = v_redemption.brinde_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND OR (v_reward.estoque IS NOT NULL AND v_reward.estoque < v_redemption.quantity) THEN
      RAISE EXCEPTION 'O brinde está sem estoque';
    END IF;

    IF v_redemption.ixc_cliente_id IS NOT NULL THEN
      SELECT *
      INTO v_client
      FROM public.pontuacao_campanha_clientes
      WHERE tenant_id = p_tenant_id
        AND ixc_cliente_id = v_redemption.ixc_cliente_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente não encontrado';
      END IF;

      IF coalesce(v_client.pontos_disponiveis, 0) < v_redemption.pontos_utilizados THEN
        RAISE EXCEPTION 'O cliente não possui pontos suficientes';
      END IF;

      UPDATE public.pontuacao_campanha_clientes
      SET
        pontos_resgatados = coalesce(pontos_resgatados, 0) + v_redemption.pontos_utilizados,
        ultimo_resgate = now(),
        ultima_sincronizacao_em = now()
      WHERE id = v_client.id;

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
        v_redemption.ixc_cliente_id,
        v_redemption.contato_id,
        'resgate',
        -v_redemption.pontos_utilizados,
        format('Resgate confirmado do brinde %s (x%s)', v_redemption.brinde_nome, v_redemption.quantity),
        p_actor_user_id::text
      );
    END IF;

    IF v_reward.estoque IS NOT NULL THEN
      UPDATE public.pontuacao_catalogo_brindes
      SET estoque = estoque - v_redemption.quantity
      WHERE id = v_reward.id;
    END IF;

    UPDATE public.pontuacao_resgates
    SET
      status_resgate = 'entregue',
      data_entrega = now(),
      responsavel_entrega = coalesce(nullif(btrim(coalesce(p_responsible, '')), ''), responsavel_entrega),
      observacoes = CASE WHEN p_notes IS NULL THEN observacoes ELSE nullif(btrim(coalesce(p_notes, '')), '') END,
      confirmacao_cliente = true
    WHERE id = v_redemption.id
    RETURNING *
    INTO v_redemption;

  ELSIF p_action = 'cancel' THEN
    IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Motivo é obrigatório';
    END IF;

    IF v_redemption.status_resgate = 'cancelado' THEN
      RAISE EXCEPTION 'Transição de status inválida';
    END IF;

    IF v_redemption.status_resgate = 'entregue' THEN
      v_points_to_revert := v_redemption.pontos_utilizados;

      IF v_redemption.ixc_cliente_id IS NOT NULL THEN
        SELECT *
        INTO v_client
        FROM public.pontuacao_campanha_clientes
        WHERE tenant_id = p_tenant_id
          AND ixc_cliente_id = v_redemption.ixc_cliente_id
        FOR UPDATE;

        IF FOUND THEN
          UPDATE public.pontuacao_campanha_clientes
          SET
            pontos_resgatados = GREATEST(0, coalesce(pontos_resgatados, 0) - v_points_to_revert),
            ultima_sincronizacao_em = now()
          WHERE id = v_client.id;
        END IF;
      END IF;

      SELECT *
      INTO v_reward
      FROM public.pontuacao_catalogo_brindes
      WHERE tenant_id = p_tenant_id
        AND id = v_redemption.brinde_id
      FOR UPDATE;

      IF FOUND AND v_reward.estoque IS NOT NULL THEN
        UPDATE public.pontuacao_catalogo_brindes
        SET estoque = estoque + v_redemption.quantity
        WHERE id = v_reward.id;
      END IF;
    END IF;

    UPDATE public.pontuacao_resgates
    SET
      status_resgate = 'cancelado',
      data_entrega = NULL,
      observacoes = trim(both ' ' from concat_ws(' | ', nullif(btrim(coalesce(observacoes, '')), ''), 'Cancelado: ' || btrim(p_reason)))
    WHERE id = v_redemption.id
    RETURNING *
    INTO v_redemption;

  ELSIF p_action = 'delete' THEN
    IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Motivo é obrigatório';
    END IF;

    IF v_redemption.status_resgate = 'entregue' THEN
      v_existing_response := public.mutate_legacy_redemption(
        p_tenant_id,
        p_redemption_id,
        p_actor_user_id,
        'cancel',
        p_responsible,
        p_notes,
        p_reason,
        p_expected_updated_at,
        p_idempotency_key || ':cancel'
      );

      SELECT *
      INTO v_redemption
      FROM public.pontuacao_resgates
      WHERE tenant_id = p_tenant_id
        AND id = p_redemption_id
      FOR UPDATE;
    END IF;

    UPDATE public.pontuacao_resgates
    SET
      deleted_at = now(),
      deleted_by = p_actor_user_id,
      deleted_reason = btrim(p_reason),
      observacoes = trim(both ' ' from concat_ws(' | ', nullif(btrim(coalesce(observacoes, '')), ''), 'Excluído: ' || btrim(p_reason)))
    WHERE id = v_redemption.id
    RETURNING *
    INTO v_redemption;

  ELSE
    UPDATE public.pontuacao_resgates
    SET
      responsavel_entrega = coalesce(nullif(btrim(coalesce(p_responsible, '')), ''), responsavel_entrega),
      observacoes = CASE WHEN p_notes IS NULL THEN observacoes ELSE nullif(btrim(coalesce(p_notes, '')), '') END
    WHERE id = v_redemption.id
    RETURNING *
    INTO v_redemption;
  END IF;

  v_after := to_jsonb(v_redemption);

  INSERT INTO public.pontuacao_mutation_idempotency (
    tenant_id,
    scope,
    idempotency_key,
    response_payload
  )
  VALUES (
    p_tenant_id,
    'legacy_redemption_' || p_action,
    p_idempotency_key,
    v_after
  );

  PERFORM public.write_operational_audit_log(
    p_tenant_id,
    p_actor_user_id,
    'rescue.' || p_action,
    'legacy_redemption',
    v_redemption.id::text,
    coalesce(p_reason, p_notes),
    v_before,
    v_after
  );

  RETURN v_after;
END;
$$;
