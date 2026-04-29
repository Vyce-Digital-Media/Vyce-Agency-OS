
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL, -- 'assigned', 'status_changed', 'in_review', 'approved', 'delivered'
  title text NOT NULL,
  body text,
  link text, -- optional deep link path e.g. /deliverables
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  deliverable_id uuid REFERENCES public.deliverables(id) ON DELETE CASCADE
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can mark their own notifications as read
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- System (triggers) inserts via security definer functions; also allow service role
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function: notify on deliverable changes
CREATE OR REPLACE FUNCTION public.notify_deliverable_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _title text;
  _plan record;
  _client_name text;
BEGIN
  -- Get deliverable title
  _title := NEW.title;

  -- Get client name via plan
  SELECT c.name INTO _client_name
  FROM monthly_plans mp JOIN clients c ON c.id = mp.client_id
  WHERE mp.id = NEW.plan_id;

  -- Assignment notification
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to <> NEW.assigned_to) THEN
    INSERT INTO notifications (user_id, type, title, body, deliverable_id, link)
    VALUES (
      NEW.assigned_to,
      'assigned',
      'New assignment: ' || _title,
      'You were assigned "' || _title || '" for ' || COALESCE(_client_name, 'a client') || '.',
      NEW.id,
      '/deliverables'
    );
  END IF;

  -- Status changed to in_review → notify admins and managers
  IF NEW.status = 'in_review' AND OLD.status <> 'in_review' THEN
    INSERT INTO notifications (user_id, type, title, body, deliverable_id, link)
    SELECT ur.user_id, 'in_review',
      'Ready for review: ' || _title,
      '"' || _title || '" for ' || COALESCE(_client_name, 'a client') || ' is now in review.',
      NEW.id, '/deliverables'
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'manager')
      AND ur.user_id <> auth.uid();
  END IF;

  -- Status changed to approved → notify assigned user
  IF NEW.status = 'approved' AND OLD.status <> 'approved' AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, deliverable_id, link)
    VALUES (
      NEW.assigned_to,
      'approved',
      'Approved: ' || _title,
      '"' || _title || '" has been approved!',
      NEW.id,
      '/deliverables'
    );
  END IF;

  -- Status changed to delivered → notify assigned user
  IF NEW.status = 'delivered' AND OLD.status <> 'delivered' AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, deliverable_id, link)
    VALUES (
      NEW.assigned_to,
      'delivered',
      'Delivered: ' || _title,
      '"' || _title || '" has been marked as delivered.',
      NEW.id,
      '/deliverables'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER on_deliverable_change
  AFTER UPDATE ON public.deliverables
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_deliverable_change();
