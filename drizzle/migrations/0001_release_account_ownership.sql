ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS cover_url text;

CREATE OR REPLACE FUNCTION public._release_can_access(r public.releases, p_token text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (r.user_id IS NOT NULL AND r.user_id = auth.uid())
      OR (r.user_id IS NULL AND p_token IS NOT NULL AND r.owner_token = p_token)
$$;

CREATE OR REPLACE FUNCTION public.release_get_draft(p_token text, p_id uuid) RETURNS SETOF releases
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM releases r WHERE r.id = p_id AND public._release_can_access(r, p_token);
$$;

CREATE OR REPLACE FUNCTION public.release_save(p_token text, p_id uuid, p_data jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_budget bigint; v_a numeric; v_f numeric; v_c numeric; r releases;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 OR length(p_token) > 128 THEN RAISE EXCEPTION 'invalid token'; END IF;
  v_budget := GREATEST(0, LEAST(COALESCE((p_data->>'budget_cents')::bigint, 0), 100000000000));
  v_a := GREATEST(0, LEAST(100, COALESCE((p_data->>'artist_pct')::numeric, 80)));
  v_f := GREATEST(0, LEAST(100, COALESCE((p_data->>'fee_pct')::numeric, 10)));
  v_c := GREATEST(0, LEAST(100, COALESCE((p_data->>'cause_pct')::numeric, 10)));
  IF round(v_a + v_f + v_c) <> 100 THEN RAISE EXCEPTION 'split must total 100%%'; END IF;
  IF jsonb_typeof(COALESCE(p_data->'milestones','[]'::jsonb)) <> 'array' OR jsonb_array_length(COALESCE(p_data->'milestones','[]'::jsonb)) > 12 THEN RAISE EXCEPTION 'invalid milestones'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO releases(owner_token, user_id) VALUES (p_token, auth.uid()) RETURNING id INTO v_id;
  ELSE
    SELECT * INTO r FROM releases WHERE id = p_id;
    IF r.id IS NULL OR NOT public._release_can_access(r, p_token) THEN RAISE EXCEPTION 'not found'; END IF;
    v_id := r.id;
  END IF;
  UPDATE releases SET
    title = left(COALESCE(p_data->>'title',''), 120),
    creator_name = left(COALESCE(p_data->>'creator_name',''), 100),
    creator_email = left(NULLIF(p_data->>'creator_email',''), 200),
    booking_id = CASE WHEN (p_data->>'booking_id') ~ '^[0-9a-f-]{36}$' THEN (p_data->>'booking_id')::uuid ELSE booking_id END,
    answers = COALESCE(p_data->'answers','{}'::jsonb),
    budget_cents = v_budget, artist_pct = v_a, fee_pct = v_f, cause_pct = v_c,
    cause_name = left(NULLIF(p_data->>'cause_name',''), 120),
    milestones = COALESCE(p_data->'milestones','[]'::jsonb),
    coin_mint = left(NULLIF(p_data->>'coin_mint',''), 64),
    coin_ticker = left(NULLIF(p_data->>'coin_ticker',''), 20),
    coin_name = left(NULLIF(p_data->>'coin_name',''), 80),
    coin_image = left(NULLIF(p_data->>'coin_image',''), 500),
    cover_url = CASE WHEN COALESCE(p_data->>'cover_url','') ~* '^https://' THEN left(p_data->>'cover_url', 600) ELSE NULL END,
    payout_wallet = left(NULLIF(p_data->>'payout_wallet',''), 64),
    current_step = GREATEST(1, LEAST(6, COALESCE((p_data->>'current_step')::int, 1))),
    user_id = COALESCE(user_id, auth.uid()),
    updated_at = now()
  WHERE id = v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.release_publish(p_token text, p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r releases; v_base text; v_slug text; n int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  SELECT * INTO r FROM releases WHERE id = p_id;
  IF r.id IS NULL OR NOT public._release_can_access(r, p_token) THEN RAISE EXCEPTION 'not found'; END IF;
  IF length(trim(r.title)) = 0 THEN RAISE EXCEPTION 'title required'; END IF;
  IF jsonb_array_length(r.milestones) = 0 THEN RAISE EXCEPTION 'add at least one milestone'; END IF;
  UPDATE releases SET user_id = auth.uid() WHERE id = r.id AND user_id IS NULL;
  IF r.slug IS NOT NULL THEN
    UPDATE releases SET status='published', published_at = COALESCE(published_at, now()) WHERE id = r.id;
    RETURN r.slug;
  END IF;
  v_base := left(COALESCE(NULLIF(public.rz_slugify(r.title), ''), 'project'), 48);
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM releases WHERE slug = v_slug) LOOP
    n := n + 1; v_slug := v_base || '-' || substr(md5(random()::text), 1, 4);
    IF n > 10 THEN RAISE EXCEPTION 'slug collision'; END IF;
  END LOOP;
  UPDATE releases SET slug = v_slug, status='published', published_at = now() WHERE id = r.id;
  RETURN v_slug;
END $$;

CREATE OR REPLACE FUNCTION public.release_claim(p_token text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL OR p_token IS NULL OR length(p_token) < 16 THEN RETURN 0; END IF;
  UPDATE releases SET user_id = auth.uid() WHERE owner_token = p_token AND user_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.my_releases() RETURNS SETOF releases
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM releases WHERE auth.uid() IS NOT NULL AND user_id = auth.uid() ORDER BY updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.release_set_archived(p_id uuid, p_archived boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  UPDATE releases SET status = CASE WHEN p_archived THEN 'archived' ELSE 'published' END, updated_at = now()
  WHERE id = p_id AND user_id = auth.uid() AND slug IS NOT NULL AND status IN ('published','archived');
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.release_delete(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM releases WHERE id = p_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'not found'; END IF;
  DELETE FROM release_applications WHERE release_id = p_id;
  DELETE FROM releases WHERE id = p_id AND user_id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.release_list_applications(p_token text, p_id uuid) RETURNS SETOF release_applications
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.* FROM release_applications a JOIN releases r ON r.id = a.release_id
  WHERE r.id = p_id AND auth.uid() IS NOT NULL AND r.user_id = auth.uid() ORDER BY a.role_index, a.created_at;
$$;

CREATE OR REPLACE FUNCTION public.release_set_application_status(p_token text, p_app_id uuid, p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('applied','hired') THEN RAISE EXCEPTION 'bad status'; END IF;
  UPDATE release_applications a SET status = p_status, updated_at = now() FROM releases r
  WHERE a.id = p_app_id AND r.id = a.release_id AND auth.uid() IS NOT NULL AND r.user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.release_claim(text), public.my_releases(), public.release_set_archived(uuid,boolean), public.release_delete(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.release_claim(text), public.my_releases(), public.release_set_archived(uuid,boolean), public.release_delete(uuid) TO authenticated;

CREATE POLICY "Anyone uploads project covers" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'covers' AND lower(name) ~ '\.(jpg|jpeg|png|webp)$');
CREATE POLICY "Owners remove project covers" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'covers' AND EXISTS (SELECT 1 FROM public.releases r WHERE r.user_id = auth.uid() AND r.cover_url LIKE '%/avatars/' || name));