
-- FIX 1: Profiles salary exposure
-- Replace the permissive USING(true) SELECT policy with one that blocks
-- client-role users from reading salary_hourly and other profile fields of other users.
-- team_member, manager, and admin can still read all profiles (needed for assignment UIs).
-- client-role users can only read their own profile.

DROP POLICY "Users can view all profiles" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'team_member'::app_role)
  );

-- FIX 2: Notifications INSERT bypass
-- The existing WITH CHECK(true) policy lets any authenticated user (including clients)
-- insert notifications targeting any user_id.
-- The SECURITY DEFINER trigger (notify_deliverable_change) handles all legitimate inserts
-- with elevated privileges and does NOT need an authenticated INSERT policy.
-- Admins/managers also need to insert notifications in some app flows, so we scope it.

DROP POLICY "System can insert notifications" ON public.notifications;

CREATE POLICY "Only internal roles can insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'team_member'::app_role)
  );
