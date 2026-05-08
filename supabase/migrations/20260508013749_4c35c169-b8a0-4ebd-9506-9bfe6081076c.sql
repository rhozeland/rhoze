
CREATE TABLE public.task_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_activity_task ON public.task_activity(task_id, created_at DESC);

ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team and involved read task_activity"
  ON public.task_activity FOR SELECT
  USING (
    public.is_team_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_activity.task_id
        AND (t.owner_id = auth.uid() OR t.assigned_to = auth.uid() OR t.assigned_by = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public._log_task_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _changes jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_activity (task_id, actor_id, action, details)
    VALUES (NEW.id, _actor, 'created', jsonb_build_object(
      'title', NEW.title,
      'urgent', NEW.urgent,
      'important', NEW.important,
      'scope', NEW.scope,
      'department', NEW.department,
      'assigned_to', NEW.assigned_to,
      'due_date', NEW.due_date
    ));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Completion takes precedence
    IF NEW.done IS DISTINCT FROM OLD.done AND NEW.done = true THEN
      INSERT INTO public.task_activity (task_id, actor_id, action, details)
      VALUES (NEW.id, _actor, 'completed', jsonb_build_object('title', NEW.title));
      RETURN NEW;
    END IF;
    IF NEW.done IS DISTINCT FROM OLD.done AND NEW.done = false THEN
      INSERT INTO public.task_activity (task_id, actor_id, action, details)
      VALUES (NEW.id, _actor, 'reopened', jsonb_build_object('title', NEW.title));
    END IF;
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      INSERT INTO public.task_activity (task_id, actor_id, action, details)
      VALUES (NEW.id, _actor, 'assigned', jsonb_build_object(
        'from', OLD.assigned_to, 'to', NEW.assigned_to
      ));
    END IF;
    IF NEW.acknowledged_at IS DISTINCT FROM OLD.acknowledged_at AND NEW.acknowledged_at IS NOT NULL THEN
      INSERT INTO public.task_activity (task_id, actor_id, action, details)
      VALUES (NEW.id, _actor, 'acknowledged', '{}'::jsonb);
    END IF;
    IF NEW.urgent IS DISTINCT FROM OLD.urgent OR NEW.important IS DISTINCT FROM OLD.important THEN
      INSERT INTO public.task_activity (task_id, actor_id, action, details)
      VALUES (NEW.id, _actor, 'moved', jsonb_build_object(
        'from', jsonb_build_object('urgent', OLD.urgent, 'important', OLD.important),
        'to',   jsonb_build_object('urgent', NEW.urgent, 'important', NEW.important)
      ));
    END IF;
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      _changes := _changes || jsonb_build_object('title', jsonb_build_object('from', OLD.title, 'to', NEW.title));
    END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      _changes := _changes || jsonb_build_object('notes', true);
    END IF;
    IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
      _changes := _changes || jsonb_build_object('due_date', jsonb_build_object('from', OLD.due_date, 'to', NEW.due_date));
    END IF;
    IF _changes <> '{}'::jsonb THEN
      INSERT INTO public.task_activity (task_id, actor_id, action, details)
      VALUES (NEW.id, _actor, 'edited', _changes);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.task_activity (task_id, actor_id, action, details)
    VALUES (OLD.id, _actor, 'deleted', jsonb_build_object('title', OLD.title));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_activity_ins ON public.tasks;
DROP TRIGGER IF EXISTS trg_task_activity_upd ON public.tasks;
DROP TRIGGER IF EXISTS trg_task_activity_del ON public.tasks;

CREATE TRIGGER trg_task_activity_ins AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public._log_task_activity();
CREATE TRIGGER trg_task_activity_upd AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public._log_task_activity();
CREATE TRIGGER trg_task_activity_del AFTER DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public._log_task_activity();
