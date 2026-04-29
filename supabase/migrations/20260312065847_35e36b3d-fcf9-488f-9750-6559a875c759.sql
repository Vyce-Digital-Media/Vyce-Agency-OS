-- Make both storage buckets private
-- Files will now require signed URLs for access (no public CDN access)
UPDATE storage.buckets
SET public = false
WHERE id IN ('client-assets', 'deliverable-assets');

-- Fix any remaining always-true SELECT RLS on deliverables and monthly_plans
-- (currently USING(true) — restrict to authenticated only, already is authenticated but explicit)
-- These are already gated to authenticated, so SELECT is fine as-is for internal tool.
-- The real gap is storage exposure — handled above.

-- Storage RLS: Allow authenticated users to read objects from private buckets
-- (needed so createSignedUrl works for any authenticated role)
CREATE POLICY "Authenticated users can read client-assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'client-assets');

CREATE POLICY "Authenticated users can read deliverable-assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'deliverable-assets');

-- Allow admins/managers to upload to client-assets
CREATE POLICY "Admins and managers can upload to client-assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-assets'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
    )
  );

-- Allow admins/managers/team members to upload to deliverable-assets
CREATE POLICY "Internal roles can upload to deliverable-assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'deliverable-assets'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'team_member'::public.app_role)
    )
  );

-- Allow admins to delete from both buckets
CREATE POLICY "Admins can delete from client-assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-assets'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins can delete from deliverable-assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'deliverable-assets'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR auth.uid() = (storage.foldername(name))[1]::uuid
    )
  );