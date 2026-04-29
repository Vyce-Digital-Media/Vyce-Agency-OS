
-- =====================================================================
-- 1. PROFILES — restrict full row SELECT to self + admin
-- =====================================================================
DROP POLICY IF EXISTS profiles_select ON public.profiles;

CREATE POLICY profiles_select_self_or_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Public team directory view — non-sensitive fields only.
-- Used by the app for dropdowns, assignment lists, deliverable cards, etc.
CREATE OR REPLACE VIEW public.team_directory
WITH (security_invoker = off) AS
SELECT
  p.user_id,
  p.full_name,
  p.avatar_url,
  p.internal_label
FROM public.profiles p
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = p.user_id
    AND ur.role IN ('admin','manager','team_member')
);

REVOKE ALL ON public.team_directory FROM PUBLIC;
GRANT SELECT ON public.team_directory TO authenticated;

-- =====================================================================
-- 2. CLIENTS — revoke financial column SELECT from authenticated role
-- =====================================================================
REVOKE SELECT (monthly_retainer, one_time_cost) ON public.clients FROM authenticated;
-- service_role retains full access by default

-- =====================================================================
-- 3. STORAGE — tighten SELECT policies on both buckets
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated users can read client-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read deliverable-assets" ON storage.objects;

-- client-assets: internal staff OR the owning client
CREATE POLICY "client-assets read access"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-assets'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'team_member'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.client_assets ca
        JOIN public.clients c ON c.id = ca.client_id
        WHERE ca.file_url LIKE '%' || storage.objects.name || '%'
          AND c.user_id = auth.uid()
      )
    )
  );

-- deliverable-assets: internal staff OR the client linked to the deliverable
CREATE POLICY "deliverable-assets read access"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'deliverable-assets'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'team_member'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.deliverable_assets da
        JOIN public.deliverables d ON d.id = da.deliverable_id
        JOIN public.monthly_plans mp ON mp.id = d.plan_id
        JOIN public.clients c ON c.id = mp.client_id
        WHERE da.file_url LIKE '%' || storage.objects.name || '%'
          AND c.user_id = auth.uid()
      )
    )
  );

-- =====================================================================
-- 4. REALTIME — restrict channel subscriptions to user's own topic
-- =====================================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only subscribe to their own channel" ON realtime.messages;

CREATE POLICY "Users can only subscribe to their own channel"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    -- channel topic must match: notifications:<auth.uid()>
    realtime.topic() = 'notifications:' || auth.uid()::text
    OR realtime.topic() LIKE 'lov-broadcast-%'  -- keep internal topics
  );
