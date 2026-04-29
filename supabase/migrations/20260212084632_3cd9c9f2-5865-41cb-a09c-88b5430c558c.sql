
-- Add approval tracking columns to deliverables
ALTER TABLE public.deliverables
ADD COLUMN approved_by uuid,
ADD COLUMN approved_at timestamp with time zone;

-- Create deliverable_assets table
CREATE TABLE public.deliverable_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deliverable_id uuid NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  uploaded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.deliverable_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view deliverable assets"
ON public.deliverable_assets FOR SELECT USING (true);

CREATE POLICY "Admins and managers can insert deliverable assets"
ON public.deliverable_assets FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR auth.uid() = uploaded_by);

CREATE POLICY "Admins can delete deliverable assets"
ON public.deliverable_assets FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = uploaded_by);

-- Create client_assets table (brand library)
CREATE TABLE public.client_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  category text NOT NULL DEFAULT 'other',
  uploaded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.client_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view client assets"
ON public.client_assets FOR SELECT USING (true);

CREATE POLICY "Admins and managers can insert client assets"
ON public.client_assets FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can delete client assets"
ON public.client_assets FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('deliverable-assets', 'deliverable-assets', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('client-assets', 'client-assets', true);

-- Storage policies for deliverable-assets
CREATE POLICY "Anyone can view deliverable assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'deliverable-assets');

CREATE POLICY "Authenticated users can upload deliverable assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'deliverable-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own deliverable assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'deliverable-assets' AND auth.role() = 'authenticated');

-- Storage policies for client-assets
CREATE POLICY "Anyone can view client assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'client-assets');

CREATE POLICY "Authenticated users can upload client assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'client-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own client assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'client-assets' AND auth.role() = 'authenticated');
