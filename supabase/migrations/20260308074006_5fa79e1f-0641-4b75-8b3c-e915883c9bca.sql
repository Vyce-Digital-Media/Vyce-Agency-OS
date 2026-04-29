
-- Create time_entries table for clock in/out tracking
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  duration_minutes integer GENERATED ALWAYS AS (
    CASE WHEN clock_out IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (clock_out - clock_in))::integer / 60 
    ELSE NULL END
  ) STORED,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Users can insert their own entries
CREATE POLICY "Users can insert own time entries"
  ON public.time_entries FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own entries
CREATE POLICY "Users can update own time entries"
  ON public.time_entries FOR UPDATE
  USING (user_id = auth.uid());

-- Users can view their own entries; admins and managers can view all
CREATE POLICY "Users and admins can view time entries"
  ON public.time_entries FOR SELECT
  USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
  );

-- Admins can delete any entry
CREATE POLICY "Admins can delete time entries"
  ON public.time_entries FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Index for fast lookups by user and date
CREATE INDEX idx_time_entries_user_date ON public.time_entries (user_id, date);
CREATE INDEX idx_time_entries_date ON public.time_entries (date);
