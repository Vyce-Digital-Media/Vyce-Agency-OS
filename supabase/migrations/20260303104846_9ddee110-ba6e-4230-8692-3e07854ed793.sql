
-- Add priority column to deliverables
ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium'
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Add needs_approval enum value
ALTER TYPE deliverable_status ADD VALUE IF NOT EXISTS 'needs_approval' AFTER 'in_review';

-- Update notify trigger to also fire on needs_approval
CREATE OR REPLACE FUNCTION public.notify_deliverable_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _title text;
  _client_name text;
BEGIN
  _title := NEW.title;

  SELECT c.name INTO _client_name
  FROM monthly_plans mp JOIN clients c ON c.id = mp.client_id
  WHERE mp.id = NEW.plan_id;

  -- Assignment notification
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to <> NEW.assigned_to) THEN
    INSERT INTO notifications (user_id, type, title, body, deliverable_id, link)
    VALUES (
      NEW.assigned_to, 'assigned',
      'New assignment: ' || _title,
      'You were assigned "' || _title || '" for ' || COALESCE(_client_name, 'a client') || '.',
      NEW.id, '/deliverables'
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
      AND ur.user_id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000');
  END IF;

  -- Status changed to needs_approval → notify admins and managers
  IF NEW.status = 'needs_approval' AND OLD.status <> 'needs_approval' THEN
    INSERT INTO notifications (user_id, type, title, body, deliverable_id, link)
    SELECT ur.user_id, 'needs_approval',
      'Needs approval: ' || _title,
      '"' || _title || '" for ' || COALESCE(_client_name, 'a client') || ' is ready for your approval.',
      NEW.id, '/deliverables'
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'manager')
      AND ur.user_id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000');
  END IF;

  -- Status changed to approved → notify assigned user
  IF NEW.status = 'approved' AND OLD.status <> 'approved' AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, deliverable_id, link)
    VALUES (
      NEW.assigned_to, 'approved',
      'Approved: ' || _title,
      '"' || _title || '" has been approved!',
      NEW.id, '/deliverables'
    );
    -- also store who approved
    UPDATE deliverables SET approved_by = auth.uid(), approved_at = now() WHERE id = NEW.id;
  END IF;

  -- Status changed to delivered → notify assigned user
  IF NEW.status = 'delivered' AND OLD.status <> 'delivered' AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, deliverable_id, link)
    VALUES (
      NEW.assigned_to, 'delivered',
      'Delivered: ' || _title,
      '"' || _title || '" has been marked as delivered.',
      NEW.id, '/deliverables'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_deliverable_change ON public.deliverables;
CREATE TRIGGER on_deliverable_change
  AFTER INSERT OR UPDATE ON public.deliverables
  FOR EACH ROW EXECUTE FUNCTION public.notify_deliverable_change();
