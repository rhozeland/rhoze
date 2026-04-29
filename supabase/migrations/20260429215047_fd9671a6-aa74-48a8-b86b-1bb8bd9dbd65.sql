CREATE TABLE public.profile_employment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  job_title text,
  department public.department,
  started_at date,
  ended_at date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_peh_user ON public.profile_employment_history(user_id, started_at DESC);

ALTER TABLE public.profile_employment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team reads employment history"
ON public.profile_employment_history FOR SELECT TO authenticated
USING (public.is_team_member(auth.uid()));

CREATE POLICY "Admins insert employment history"
ON public.profile_employment_history FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update employment history"
ON public.profile_employment_history FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete employment history"
ON public.profile_employment_history FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_peh_updated_at
BEFORE UPDATE ON public.profile_employment_history
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();