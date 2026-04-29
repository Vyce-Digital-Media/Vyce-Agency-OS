
-- Allow admins and managers to UPDATE any time entry (to correct missed clock-outs)
CREATE POLICY "Admins can update any time entry"
  ON public.time_entries FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Drop the restrictive INSERT policy and replace with one that allows admin/manager to log on behalf
DROP POLICY "Users can insert own time entries" ON public.time_entries;

CREATE POLICY "Users can insert time entries"
  ON public.time_entries FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );
