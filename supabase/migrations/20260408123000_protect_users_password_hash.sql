-- Keep browser-exposed profile reads limited to the authenticated user's own row.
DROP POLICY IF EXISTS user_read_own ON public.users;
DROP POLICY IF EXISTS user_read_own_profile ON public.users;

CREATE POLICY user_read_own_profile
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Never expose credential material through PostgREST/Supabase browser roles.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'password_hash'
  ) THEN
    EXECUTE 'REVOKE ALL (password_hash) ON public.users FROM PUBLIC';
    EXECUTE 'REVOKE ALL (password_hash) ON public.users FROM anon';
    EXECUTE 'REVOKE ALL (password_hash) ON public.users FROM authenticated';
  END IF;
END
$$;
