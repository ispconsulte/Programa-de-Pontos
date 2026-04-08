-- Backend-only write paths:
-- these tables are written by service-role Edge Functions or backend jobs,
-- never directly by browser-exposed authenticated sessions.

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'ixc_recebiveis_raw',
    'pontuacao_movimentos',
    'pontuacao_saldos',
    'campaign_events',
    'reward_redemptions',
    'pontuacao_faturas_processadas',
    'pontuacao_historico'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      target_table || '_deny_browser_insert',
      target_table
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      target_table || '_deny_browser_update',
      target_table
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      target_table || '_deny_browser_delete',
      target_table
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (false)',
      target_table || '_deny_browser_insert',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (false) WITH CHECK (false)',
      target_table || '_deny_browser_update',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (false)',
      target_table || '_deny_browser_delete',
      target_table
    );
  END LOOP;
END
$$;
