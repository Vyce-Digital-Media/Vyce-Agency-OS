
-- ============================================================
-- A. DROP LEGACY STORAGE POLICIES
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view deliverable assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view client assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload deliverable assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload client assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own deliverable assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own client assets" ON storage.objects;

-- ============================================================
-- B. LOCK DOWN clients SELECT
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
CREATE POLICY "clients_select" ON public.clients FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'team_member'::public.app_role)
    OR user_id = auth.uid()
  );

-- ============================================================
-- C. SCOPE client_assets SELECT to authenticated + role-based
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view client assets" ON public.client_assets;
CREATE POLICY "client_assets_select" ON public.client_assets FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'team_member'::public.app_role)
    OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

-- Fix INSERT/DELETE/UPDATE policies to use authenticated instead of public
DROP POLICY IF EXISTS "Admins and managers can insert client assets" ON public.client_assets;
CREATE POLICY "client_assets_insert" ON public.client_assets FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins can delete client assets" ON public.client_assets;
CREATE POLICY "client_assets_delete" ON public.client_assets FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins and managers can update client assets" ON public.client_assets;
CREATE POLICY "client_assets_update" ON public.client_assets FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

-- ============================================================
-- D. SCOPE deliverable_assets SELECT to authenticated + role-based
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view deliverable assets" ON public.deliverable_assets;
CREATE POLICY "deliverable_assets_select" ON public.deliverable_assets FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'team_member'::public.app_role)
    OR deliverable_id IN (
      SELECT d.id FROM public.deliverables d
      JOIN public.monthly_plans mp ON mp.id = d.plan_id
      JOIN public.clients c ON c.id = mp.client_id
      WHERE c.user_id = auth.uid()
    )
  );

-- Fix INSERT/DELETE policies to authenticated
DROP POLICY IF EXISTS "Admins and managers can insert deliverable assets" ON public.deliverable_assets;
CREATE POLICY "deliverable_assets_insert" ON public.deliverable_assets FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR auth.uid() = uploaded_by
  );

DROP POLICY IF EXISTS "Admins can delete deliverable assets" ON public.deliverable_assets;
CREATE POLICY "deliverable_assets_delete" ON public.deliverable_assets FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR auth.uid() = uploaded_by
  );

-- ============================================================
-- E. SCOPE deliverables SELECT
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view deliverables" ON public.deliverables;
CREATE POLICY "deliverables_select" ON public.deliverables FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'team_member'::public.app_role)
    OR plan_id IN (
      SELECT mp.id FROM public.monthly_plans mp
      JOIN public.clients c ON c.id = mp.client_id
      WHERE c.user_id = auth.uid()
    )
  );

-- ============================================================
-- F. SCOPE monthly_plans SELECT
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view plans" ON public.monthly_plans;
CREATE POLICY "monthly_plans_select" ON public.monthly_plans FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'team_member'::public.app_role)
    OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

-- ============================================================
-- G. FIX time_entries policies from public to authenticated
-- ============================================================
DROP POLICY IF EXISTS "Users can update own time entries" ON public.time_entries;
CREATE POLICY "Users can update own time entries" ON public.time_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users and admins can view time entries" ON public.time_entries;
CREATE POLICY "time_entries_select" ON public.time_entries FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins can delete time entries" ON public.time_entries;
CREATE POLICY "time_entries_delete" ON public.time_entries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update any time entry" ON public.time_entries;
CREATE POLICY "Admins can update any time entry" ON public.time_entries FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

DROP POLICY IF EXISTS "Users can insert time entries" ON public.time_entries;
CREATE POLICY "time_entries_insert" ON public.time_entries FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

-- ============================================================
-- H. USER_ROLES: allow managers to view roles too
-- ============================================================
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

-- ============================================================
-- I. PROFILES: restrict self-update of salary/expected_start_time
-- ============================================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      -- Non-admins cannot change salary or expected start time
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR (
        COALESCE(salary_hourly, -1) = COALESCE((SELECT p.salary_hourly FROM public.profiles p WHERE p.user_id = auth.uid()), -1)
        AND COALESCE(expected_start_time, '00:00'::time) = COALESCE((SELECT p.expected_start_time FROM public.profiles p WHERE p.user_id = auth.uid()), '00:00'::time)
      )
    )
  );

-- Fix profiles INSERT to authenticated
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Fix admins update to authenticated
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
