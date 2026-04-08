-- Remove legacy RLS policies that rely on app.tenant_id, which any
-- authenticated session can set and abuse to cross tenant boundaries.
DROP POLICY IF EXISTS tenant_isolation ON public.tenants;
DROP POLICY IF EXISTS user_isolation ON public.users;
DROP POLICY IF EXISTS audit_isolation ON public.audit_logs;

-- Keep tenant access tied to the authenticated user's membership.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenants'
      AND policyname = 'tenant_access'
  ) THEN
    CREATE POLICY tenant_access
    ON public.tenants
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.id = auth.uid()
          AND users.tenant_id = tenants.id
      )
    );
  END IF;
END
$$;

-- Users should only be able to read their own membership row.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'user_read_own_profile'
  ) THEN
    CREATE POLICY user_read_own_profile
    ON public.users
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());
  END IF;
END
$$;

-- Audit logs remain tenant-scoped based on the authenticated user's membership.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs'
      AND policyname = 'audit_logs_select_own_tenant'
  ) THEN
    CREATE POLICY audit_logs_select_own_tenant
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.id = auth.uid()
          AND users.tenant_id = audit_logs.tenant_id
      )
    );
  END IF;
END
$$;
