
-- Add break tracking flag to time_entries
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS is_break boolean NOT NULL DEFAULT false;

-- Add expected start time to profiles for attendance tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expected_start_time time DEFAULT '09:00:00';

-- Index for break lookups
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date_break ON public.time_entries (user_id, date, is_break);
