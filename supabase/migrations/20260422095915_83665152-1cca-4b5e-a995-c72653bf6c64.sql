
DROP FUNCTION IF EXISTS public.get_team_directory();

CREATE OR REPLACE FUNCTION public.get_team_directory()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  internal_label text,
  expected_start_time time
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.avatar_url, p.internal_label, p.expected_start_time
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.user_id
      AND ur.role IN ('admin','manager','team_member')
  )
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'team_member'::app_role)
    );
$$;

REVOKE ALL ON FUNCTION public.get_team_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_directory() TO authenticated;
