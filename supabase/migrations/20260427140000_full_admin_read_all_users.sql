-- Allow full_admin users to read all user rows (bypasses tenant isolation).
CREATE POLICY full_admin_read_all_users
ON public.users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.is_full_admin = true
  )
);
