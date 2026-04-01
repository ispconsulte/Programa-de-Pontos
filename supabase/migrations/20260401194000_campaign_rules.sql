-- Campaign settings and scoring rules

CREATE TABLE IF NOT EXISTS public.pontuacao_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  ativa boolean NOT NULL DEFAULT true,
  data_inicio date,
  data_fim date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pontuacao_campanhas_nome_not_blank CHECK (btrim(nome) <> ''),
  CONSTRAINT pontuacao_campanhas_periodo_valido CHECK (data_fim IS NULL OR data_inicio IS NULL OR data_fim >= data_inicio)
);

CREATE UNIQUE INDEX IF NOT EXISTS pontuacao_campanhas_tenant_single_active_idx
  ON public.pontuacao_campanhas (tenant_id)
  WHERE ativa = true;

CREATE INDEX IF NOT EXISTS pontuacao_campanhas_tenant_updated_idx
  ON public.pontuacao_campanhas (tenant_id, updated_at DESC);

DROP TRIGGER IF EXISTS set_updated_at_pontuacao_campanhas ON public.pontuacao_campanhas;
CREATE TRIGGER set_updated_at_pontuacao_campanhas
BEFORE UPDATE ON public.pontuacao_campanhas
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.pontuacao_campanha_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campanha_id uuid NOT NULL REFERENCES public.pontuacao_campanhas(id) ON DELETE CASCADE,
  regra_codigo text NOT NULL CHECK (regra_codigo IN ('antecipado', 'no_vencimento', 'apos_vencimento')),
  dias_antecedencia_min integer,
  pontos integer NOT NULL CHECK (pontos >= 0),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pontuacao_campanha_regras_unique UNIQUE (campanha_id, regra_codigo),
  CONSTRAINT pontuacao_campanha_regras_dias_antecedencia_validos CHECK (
    (regra_codigo = 'antecipado' AND dias_antecedencia_min IS NOT NULL AND dias_antecedencia_min >= 0)
    OR
    (regra_codigo IN ('no_vencimento', 'apos_vencimento') AND dias_antecedencia_min IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS pontuacao_campanha_regras_tenant_campanha_idx
  ON public.pontuacao_campanha_regras (tenant_id, campanha_id, regra_codigo);

DROP TRIGGER IF EXISTS set_updated_at_pontuacao_campanha_regras ON public.pontuacao_campanha_regras;
CREATE TRIGGER set_updated_at_pontuacao_campanha_regras
BEFORE UPDATE ON public.pontuacao_campanha_regras
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Seed one default active campaign per tenant when missing
INSERT INTO public.pontuacao_campanhas (tenant_id, nome, descricao, ativa, data_inicio)
SELECT t.id, 'Campanha padrão', 'Campanha inicial de pontuação por pagamento', true, CURRENT_DATE
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.pontuacao_campanhas c
  WHERE c.tenant_id = t.id
);

-- Seed default rules (5/4/2) when missing
INSERT INTO public.pontuacao_campanha_regras (tenant_id, campanha_id, regra_codigo, dias_antecedencia_min, pontos, ativo)
SELECT c.tenant_id, c.id, x.regra_codigo, x.dias_antecedencia_min, x.pontos, true
FROM public.pontuacao_campanhas c
CROSS JOIN (
  VALUES
    ('antecipado'::text, 3::integer, 5::integer),
    ('no_vencimento'::text, NULL::integer, 4::integer),
    ('apos_vencimento'::text, NULL::integer, 2::integer)
) AS x(regra_codigo, dias_antecedencia_min, pontos)
ON CONFLICT (campanha_id, regra_codigo) DO NOTHING;

ALTER TABLE public.pontuacao_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontuacao_campanha_regras ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pontuacao_campanhas' AND policyname = 'pontuacao_campanhas_select'
  ) THEN
    CREATE POLICY pontuacao_campanhas_select
      ON public.pontuacao_campanhas
      FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.tenant_id = pontuacao_campanhas.tenant_id
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pontuacao_campanhas' AND policyname = 'pontuacao_campanhas_write'
  ) THEN
    CREATE POLICY pontuacao_campanhas_write
      ON public.pontuacao_campanhas
      FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.tenant_id = pontuacao_campanhas.tenant_id
          AND u.role IN ('admin', 'owner', 'manager')
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.tenant_id = pontuacao_campanhas.tenant_id
          AND u.role IN ('admin', 'owner', 'manager')
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pontuacao_campanha_regras' AND policyname = 'pontuacao_campanha_regras_select'
  ) THEN
    CREATE POLICY pontuacao_campanha_regras_select
      ON public.pontuacao_campanha_regras
      FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.tenant_id = pontuacao_campanha_regras.tenant_id
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pontuacao_campanha_regras' AND policyname = 'pontuacao_campanha_regras_write'
  ) THEN
    CREATE POLICY pontuacao_campanha_regras_write
      ON public.pontuacao_campanha_regras
      FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.tenant_id = pontuacao_campanha_regras.tenant_id
          AND u.role IN ('admin', 'owner', 'manager')
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.tenant_id = pontuacao_campanha_regras.tenant_id
          AND u.role IN ('admin', 'owner', 'manager')
      ));
  END IF;
END $$;
