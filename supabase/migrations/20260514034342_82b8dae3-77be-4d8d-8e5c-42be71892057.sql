
CREATE TABLE public.role_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('department','job_title')),
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, label)
);

ALTER TABLE public.role_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team reads role presets"
  ON public.role_presets FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()));

CREATE POLICY "Admins insert role presets"
  ON public.role_presets FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update role presets"
  ON public.role_presets FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete role presets"
  ON public.role_presets FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_role_presets_updated_at
  BEFORE UPDATE ON public.role_presets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
