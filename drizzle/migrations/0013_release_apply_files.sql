ALTER TABLE public.release_applications ADD COLUMN IF NOT EXISTS files jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE POLICY "Anyone uploads application attachments"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'applications');

CREATE OR REPLACE FUNCTION public.release_apply(p_slug text, p_role_index int, p_name text, p_link text, p_availability text, p_files jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r releases; v_role jsonb; v_id uuid;
BEGIN
  SELECT * INTO r FROM releases WHERE slug = p_slug AND status = 'published';
  IF r.id IS NULL THEN RAISE EXCEPTION 'project not found'; END IF;
  IF COALESCE(r.answers->>'project_type','') <> 'brand' THEN RAISE EXCEPTION 'not a brand project'; END IF;
  v_role := r.answers->'roles'->p_role_index;
  IF v_role IS NULL OR length(trim(COALESCE(v_role->>'name',''))) = 0 THEN RAISE EXCEPTION 'role not found'; END IF;
  p_name := trim(COALESCE(p_name,'')); p_link := trim(COALESCE(p_link,'')); p_availability := trim(COALESCE(p_availability,''));
  IF length(p_name) = 0 OR length(p_name) > 100 THEN RAISE EXCEPTION 'name required (max 100)'; END IF;
  IF length(p_link) > 0 AND (length(p_link) > 500 OR p_link !~* '^https?://') THEN RAISE EXCEPTION 'link must start with http'; END IF;
  IF length(p_availability) = 0 OR length(p_availability) > 2000 THEN RAISE EXCEPTION 'description required (max 2000)'; END IF;
  IF p_files IS NULL OR jsonb_typeof(p_files) IS DISTINCT FROM 'array' THEN p_files := '[]'::jsonb; END IF;
  IF jsonb_array_length(p_files) > 6 THEN RAISE EXCEPTION 'max 6 files'; END IF;
  IF (SELECT count(*) FROM release_applications WHERE release_id = r.id AND created_at > now() - interval '1 hour') > 50 THEN RAISE EXCEPTION 'too many applications, try later'; END IF;
  INSERT INTO release_applications(release_id, role_index, role_name, name, link, availability, files)
  VALUES (r.id, p_role_index, v_role->>'name', p_name, p_link, p_availability, p_files) RETURNING id INTO v_id;
  RETURN v_id;
END $$;