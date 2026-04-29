
ALTER TABLE public.monthly_plans
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'social_media'
    CHECK (plan_type IN ('social_media', 'website_development', 'content_marketing', 'branding', 'other')),
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS deliverables_breakdown jsonb DEFAULT '{}'::jsonb;
