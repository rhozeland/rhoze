-- Project revenue-share allocations
CREATE TABLE IF NOT EXISTS public.project_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  share_pct numeric(6,3) NOT NULL DEFAULT 0,
  role_label text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

ALTER TABLE public.project_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team reads allocations" ON public.project_allocations
  FOR SELECT USING (public.is_team_member(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Admins manage allocations" ON public.project_allocations
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_project_allocations_updated_at
  BEFORE UPDATE ON public.project_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend pay_stubs for the new payroll run flow
ALTER TABLE public.pay_stubs
  ADD COLUMN IF NOT EXISTS timesheet_period_id uuid,
  ADD COLUMN IF NOT EXISTS hourly_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flat_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revshare_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expense_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_method text,
  ADD COLUMN IF NOT EXISTS paid_reference text;

-- pay_period_id was NOT NULL referencing legacy pay_periods; relax it so the
-- new flow can use timesheet_period_id instead.
ALTER TABLE public.pay_stubs ALTER COLUMN pay_period_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pay_stubs_tsperiod ON public.pay_stubs(timesheet_period_id);
CREATE INDEX IF NOT EXISTS idx_project_allocations_user ON public.project_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_project_allocations_project ON public.project_allocations(project_id);