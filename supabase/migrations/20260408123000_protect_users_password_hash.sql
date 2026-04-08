-- Keep browser-exposed profile reads limited to the authenticated user's own row.
DROP POLICY IF EXISTS user_read_own ON public.users;
DROP POLICY IF EXISTS user_read_own_profile ON public.users;

CREATE POLICY user_read_own_profile
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Never expose credential material through PostgREST/Supabase browser roles.
REVOKE ALL (password_hash) ON public.users FROM PUBLIC;
REVOKE ALL (password_hash) ON public.users FROM anon;
REVOKE ALL (password_hash) ON public.users FROM authenticated;
