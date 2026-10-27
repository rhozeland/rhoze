CREATE OR REPLACE FUNCTION public.release_publish(p_token text, p_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r releases; v_base text; v_slug text; n int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  SELECT * INTO r FROM releases WHERE id = p_id;
  IF r.id IS NULL OR NOT public._release_can_access(r, p_token) THEN RAISE EXCEPTION 'not found'; END IF;
  IF length(trim(COALESCE(r.title,''))) = 0 THEN RAISE EXCEPTION 'title required'; END IF;
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
END $function$;