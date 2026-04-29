
-- Add hourly salary rate to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS salary_hourly numeric(10,2) DEFAULT NULL;

-- Allow admins to update any profile (including salary)
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));
