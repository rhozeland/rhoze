
CREATE OR REPLACE FUNCTION public._credit_request_activity()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _subject text;
  _body text;
  _project_title text;
BEGIN
  SELECT title INTO _project_title FROM public.projects WHERE id = NEW.project_id;
  IF TG_OP = 'INSERT' THEN
    _subject := format('Credit request: %s', NEW.title);
    _body := format('New credit request on "%s" — %s credit(s) requested.%s',
                    COALESCE(_project_title,'project'),
                    NEW.requested_credits,
                    CASE WHEN NEW.description IS NOT NULL THEN E'\n\n' || NEW.description ELSE '' END);
    INSERT INTO public.activities (subject, body, type, owner_id)
    VALUES (_subject, _body, 'note', NEW.requested_by);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    _subject := format('Credit request %s: %s', NEW.status, NEW.title);
    _body := format('Status changed from %s to %s on "%s".', OLD.status, NEW.status, COALESCE(_project_title,'project'));
    INSERT INTO public.activities (subject, body, type, owner_id)
    VALUES (_subject, _body, 'note', COALESCE(NEW.decided_by, NEW.requested_by));
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credit_request_activity
AFTER INSERT OR UPDATE ON public.credit_requests
FOR EACH ROW EXECUTE FUNCTION public._credit_request_activity();
