
ALTER TABLE public.client_assets
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'file',
  ADD COLUMN IF NOT EXISTS asset_name text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'general';

ALTER TABLE public.client_assets
  ADD CONSTRAINT client_assets_content_type_check CHECK (content_type IN ('file', 'link', 'note')),
  ADD CONSTRAINT client_assets_section_check CHECK (section IN ('brand_identity', 'social_media', 'content', 'web', 'documents', 'general'));

-- Allow managers to update assets (for editing name/notes)
CREATE POLICY "Admins and managers can update client assets"
  ON public.client_assets FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
