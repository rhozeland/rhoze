-- Status enum for milestones (pending → submitted → approved, plus cancelled)
DO $$ BEGIN
  CREATE TYPE public.milestone_status AS ENUM ('pending','submitted','approved','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  status public.milestone_status NOT NULL DEFAULT 'pending',
  credit_cost integer NOT NULL DEFAULT 0,
  due_date date,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON public.project_milestones(project_id, sort_order);

ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team & client read milestones" ON public.project_milestones;
CREATE POLICY "Team & client read milestones"
  ON public.project_milestones FOR SELECT
  USING (public.is_team_member(auth.uid()) OR public.is_project_member(auth.uid(), project_id));

DROP POLICY IF EXISTS "Team writes milestones" ON public.project_milestones;
CREATE POLICY "Team writes milestones"
  ON public.project_milestones FOR INSERT
  WITH CHECK (public.is_team_member(auth.uid()));

DROP POLICY IF EXISTS "Team updates milestones" ON public.project_milestones;
CREATE POLICY "Team updates milestones"
  ON public.project_milestones FOR UPDATE
  USING (public.is_team_member(auth.uid()))
  WITH CHECK (public.is_team_member(auth.uid()));

DROP POLICY IF EXISTS "Admins delete milestones" ON public.project_milestones;
CREATE POLICY "Admins delete milestones"
  ON public.project_milestones FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_project_milestones_updated ON public.project_milestones;
CREATE TRIGGER trg_project_milestones_updated
  BEFORE UPDATE ON public.project_milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Original intake estimate snapshot for delta tracking on the client portal
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS intake_estimate_cents integer NOT NULL DEFAULT 0;