CREATE OR REPLACE FUNCTION public.release_apply(p_slug text, p_role_index int, p_name text, p_link text, p_availability text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r releases; v_role jsonb; v_id uuid; _uid uuid := auth.uid(); _bslug text; _thread uuid;
BEGIN
  SELECT * INTO r FROM releases WHERE slug = p_slug AND status = 'published';
  IF r.id IS NULL THEN RAISE EXCEPTION 'project not found'; END IF;
  IF COALESCE(r.answers->>'project_type','') <> 'brand' THEN RAISE EXCEPTION 'not a brand project'; END IF;
  v_role := r.answers->'roles'->p_role_index;
  IF v_role IS NULL OR length(trim(COALESCE(v_role->>'name',''))) = 0 THEN RAISE EXCEPTION 'role not found'; END IF;
  p_name := trim(COALESCE(p_name,'')); p_link := trim(COALESCE(p_link,'')); p_availability := trim(COALESCE(p_availability,''));
  IF length(p_link) > 0 AND p_link !~* '^https?://' THEN p_link := 'https://' || p_link; END IF;
  IF length(p_name) = 0 OR length(p_name) > 100 THEN RAISE EXCEPTION 'name required (max 100)'; END IF;
  IF length(p_link) = 0 OR length(p_link) > 500 THEN RAISE EXCEPTION 'valid link required'; END IF;
  IF length(p_availability) = 0 OR length(p_availability) > 500 THEN RAISE EXCEPTION 'availability required (max 500)'; END IF;
  IF (SELECT count(*) FROM release_applications WHERE release_id = r.id AND created_at > now() - interval '1 hour') > 50 THEN RAISE EXCEPTION 'too many applications, try later'; END IF;
  INSERT INTO release_applications(release_id, role_index, role_name, name, link, availability)
  VALUES (r.id, p_role_index, v_role->>'name', p_name, p_link, p_availability) RETURNING id INTO v_id;
  IF _uid IS NOT NULL AND _uid IS DISTINCT FROM r.user_id THEN
    _bslug := rz_slugify(r.creator_name);
    INSERT INTO dm_threads (starter_id, owner_id, profile_kind, profile_slug, profile_name)
    VALUES (_uid, r.user_id, 'brand', _bslug, r.creator_name)
    ON CONFLICT (starter_id, profile_kind, profile_slug) DO UPDATE SET owner_id = coalesce(dm_threads.owner_id, EXCLUDED.owner_id)
    RETURNING id INTO _thread;
    INSERT INTO dm_messages (thread_id, sender_id, body) VALUES (_thread, _uid,
      'Application: ' || (v_role->>'name') || ' on ' || r.title || E'\nName: ' || p_name || E'\nLink: ' || p_link || E'\nAvailability: ' || p_availability || E'\nProject: /release/' || r.slug);
  END IF;
  RETURN v_id;
END $$;