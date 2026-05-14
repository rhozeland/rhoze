
ALTER TABLE public.role_presets DROP CONSTRAINT IF EXISTS role_presets_kind_check;
ALTER TABLE public.role_presets ADD CONSTRAINT role_presets_kind_check
  CHECK (kind IN ('department','job_title','position'));

INSERT INTO public.role_presets (kind, label, sort_order) VALUES
  ('position', 'admin', 0),
  ('position', 'employee', 1),
  ('position', 'client', 2)
ON CONFLICT (kind, label) DO NOTHING;
