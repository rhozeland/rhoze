CREATE OR REPLACE FUNCTION public.rz_slugify(_t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(_t,'')), '[^a-z0-9]+', '-', 'g'))
$$;

ALTER TABLE public.creator_directory
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS work_samples jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.creator_directory SET slug = public.rz_slugify(display_name) || '-' || left(id::text, 6) WHERE slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS creator_directory_slug_key ON public.creator_directory(slug);

CREATE OR REPLACE FUNCTION public._creator_set_slug() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.rz_slugify(NEW.display_name) || '-' || left(NEW.id::text, 6);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS creator_set_slug ON public.creator_directory;
CREATE TRIGGER creator_set_slug BEFORE INSERT ON public.creator_directory FOR EACH ROW EXECUTE FUNCTION public._creator_set_slug();

CREATE TABLE IF NOT EXISTS public.brand_profiles (
  slug text PRIMARY KEY,
  name text NOT NULL,
  logo_url text,
  category text,
  bio text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.brand_profiles TO anon, authenticated;
GRANT ALL ON public.brand_profiles TO service_role;
ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brand profiles are public" ON public.brand_profiles FOR SELECT TO anon, authenticated USING (true);

-- Owner-or-team edit of a creator profile (only safe fields)
CREATE OR REPLACE FUNCTION public.creator_save_profile(p_id uuid, p_bio text, p_instagram text, p_website text, p_samples jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM creator_directory WHERE id = p_id AND (user_id = auth.uid() OR is_team_member(auth.uid()))) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF p_samples IS NOT NULL AND (jsonb_typeof(p_samples) <> 'array' OR jsonb_array_length(p_samples) > 30) THEN
    RAISE EXCEPTION 'Invalid samples';
  END IF;
  UPDATE creator_directory SET
    bio = left(p_bio, 2000),
    instagram_url = left(nullif(trim(p_instagram),''), 300),
    website_url = left(nullif(trim(p_website),''), 300),
    work_samples = coalesce(p_samples, '[]'::jsonb),
    updated_at = now()
  WHERE id = p_id;
END $$;

-- Hired credits for a creator, from published projects only
CREATE OR REPLACE FUNCTION public.creator_credits(p_slug text)
RETURNS TABLE(release_slug text, title text, brand text, role_name text, hired_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.slug, r.title, r.creator_name, a.role_name, a.updated_at
  FROM creator_directory c
  JOIN release_applications a ON a.status = 'hired'
    AND (a.link ILIKE '%/creator/' || c.slug || '%' OR lower(trim(a.name)) = lower(trim(c.display_name)))
  JOIN releases r ON r.id = a.release_id AND r.status = 'published'
  WHERE c.slug = p_slug AND c.approved = true
  ORDER BY a.updated_at DESC
$$;

-- Brand profile save: existing owner, team, or signed-in owner of a published project under this brand
CREATE OR REPLACE FUNCTION public.brand_save_profile(p_slug text, p_name text, p_logo text, p_category text, p_bio text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing brand_profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO existing FROM brand_profiles WHERE slug = p_slug;
  IF NOT (
    is_team_member(auth.uid())
    OR (existing.slug IS NOT NULL AND existing.user_id = auth.uid())
    OR ((existing.slug IS NULL OR existing.user_id IS NULL) AND EXISTS (
      SELECT 1 FROM releases WHERE user_id = auth.uid() AND rz_slugify(creator_name) = p_slug))
  ) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  INSERT INTO brand_profiles(slug, name, logo_url, category, bio, user_id)
  VALUES (p_slug, left(coalesce(nullif(trim(p_name),''), p_slug), 120), left(nullif(trim(p_logo),''),500), left(nullif(trim(p_category),''),80), left(p_bio,2000),
          CASE WHEN is_team_member(auth.uid()) THEN NULL ELSE auth.uid() END)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, logo_url = EXCLUDED.logo_url, category = EXCLUDED.category,
    bio = EXCLUDED.bio, user_id = coalesce(brand_profiles.user_id, EXCLUDED.user_id), updated_at = now();
END $$;

-- Can the current user edit this brand?
CREATE OR REPLACE FUNCTION public.brand_can_edit(p_slug text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM brand_profiles WHERE slug = p_slug AND user_id = auth.uid())
    OR (NOT EXISTS (SELECT 1 FROM brand_profiles WHERE slug = p_slug AND user_id IS NOT NULL)
        AND EXISTS (SELECT 1 FROM releases WHERE user_id = auth.uid() AND rz_slugify(creator_name) = p_slug))
  )
$$;

REVOKE ALL ON FUNCTION public.creator_save_profile(uuid,text,text,text,jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.creator_save_profile(uuid,text,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.creator_credits(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.brand_save_profile(text,text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.brand_save_profile(text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.brand_can_edit(text) TO anon, authenticated;