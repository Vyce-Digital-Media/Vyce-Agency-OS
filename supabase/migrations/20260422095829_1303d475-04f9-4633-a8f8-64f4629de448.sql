
-- Drop previous view
DROP VIEW IF EXISTS public.team_directory;

-- Create a SECURITY DEFINER function that returns only safe directory fields.
-- This bypasses the strict profiles RLS but exposes only non-sensitive columns.
CREATE OR REPLACE FUNCTION public.get_team_directory()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  internal_label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.avatar_url, p.internal_label
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.user_id
      AND ur.role IN ('admin','manager','team_member')
  )
    AND (
      -- Only callable by authenticated internal users
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'team_member'::app_role)
    );
$$;

REVOKE ALL ON FUNCTION public.get_team_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_directory() TO authenticated;
