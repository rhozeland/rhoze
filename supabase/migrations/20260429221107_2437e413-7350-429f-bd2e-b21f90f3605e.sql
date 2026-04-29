ALTER TABLE public.service_packages
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS credits_cost integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS min_quantity integer NOT NULL DEFAULT 1;

DELETE FROM public.service_packages WHERE slug = 'studio-rental';

UPDATE public.service_packages SET category = 'audio',       credits_cost = 2, min_quantity = 2 WHERE slug = 'audio-recording';
UPDATE public.service_packages SET category = 'audio',       credits_cost = 2, min_quantity = 1 WHERE slug = 'mixing';
UPDATE public.service_packages SET category = 'audio',       credits_cost = 2, min_quantity = 1 WHERE slug = 'mastering';
UPDATE public.service_packages SET category = 'audio',       credits_cost = 3, min_quantity = 1 WHERE slug = 'podcast';
UPDATE public.service_packages SET category = 'visual',      credits_cost = 2, min_quantity = 1 WHERE slug = 'photo-shoot';
UPDATE public.service_packages SET category = 'visual',      credits_cost = 2, min_quantity = 1 WHERE slug = 'mv-edit';
UPDATE public.service_packages SET category = 'development', credits_cost = 1, min_quantity = 1 WHERE slug = 'design';
UPDATE public.service_packages SET category = 'development', credits_cost = 1, min_quantity = 1 WHERE slug = 'consult';

INSERT INTO public.service_packages (slug, name, kind, category, price_cents, credits, credits_cost, min_quantity, description, sort_order, is_active)
VALUES
  ('content-edit',     'Content editing',    'a_la_carte', 'visual',      15000, 0, 2, 1, 'Short-form social edits',         155, true),
  ('commercial-edit',  'Commercial editing', 'a_la_carte', 'visual',      30000, 0, 4, 1, 'Brand commercial cut',            156, true),
  ('short-form-edit',  'Short-form editing', 'a_la_carte', 'visual',      11250, 0, 2, 1, 'Reels / TikTok deliverable',      157, true),
  ('graphic-design',   'Graphic design',     'a_la_carte', 'development',  7500, 0, 1, 1, 'Single-asset graphic design',     171, true),
  ('web-development',  'Web development',    'a_la_carte', 'development', 60000, 0, 8, 1, 'Web build, scoped per project',   172, true),
  ('uiux-development', 'UI/UX design',       'a_la_carte', 'development', 45000, 0, 6, 1, 'UI/UX design sprint',             173, true)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.service_packages SET category = 'audio' WHERE category IS NULL AND kind = 'a_la_carte';
