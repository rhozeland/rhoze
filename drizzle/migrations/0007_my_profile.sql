CREATE OR REPLACE FUNCTION public.my_profile(p_kind text DEFAULT NULL, p_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _slug text; _name text; _photo text; _rate int; _bio text; _web text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  SELECT slug INTO _slug FROM brand_profiles WHERE user_id = _uid ORDER BY created_at LIMIT 1;
  IF _slug IS NOT NULL THEN RETURN jsonb_build_object('kind','brand','slug',_slug); END IF;
  SELECT slug INTO _slug FROM creator_directory WHERE user_id = _uid ORDER BY created_at LIMIT 1;
  IF _slug IS NOT NULL THEN RETURN jsonb_build_object('kind','creator','slug',_slug); END IF;
  IF p_kind IS NULL THEN RETURN NULL; END IF;
  SELECT coalesce(nullif(trim(alias),''), nullif(trim(display_name),''), split_part(email,'@',1)), avatar_url, hourly_rate_cents, bio, coalesce(website, portfolio_url)
    INTO _name, _photo, _rate, _bio, _web FROM profiles WHERE id = _uid;
  _name := left(coalesce(nullif(trim(p_name),''), _name, 'New member'), 100);
  IF p_kind = 'brand' THEN
    _slug := rz_slugify(_name);
    IF _slug = '' OR EXISTS (SELECT 1 FROM brand_profiles WHERE slug = _slug AND user_id IS DISTINCT FROM _uid) THEN
      _slug := _slug || '-' || left(replace(_uid::text,'-',''),6);
    END IF;
    INSERT INTO brand_profiles (slug, name, logo_url, bio, user_id) VALUES (_slug, _name, _photo, _bio, _uid);
    RETURN jsonb_build_object('kind','brand','slug',_slug);
  ELSIF p_kind = 'creator' THEN
    INSERT INTO creator_directory (display_name, photo_url, hourly_rate_cents, bio, website_url, user_id, approved, disciplines, membership_tier)
    VALUES (_name, _photo, _rate, _bio, _web, _uid, true, '{}', 'Community') RETURNING slug INTO _slug;
    RETURN jsonb_build_object('kind','creator','slug',_slug);
  END IF;
  RAISE EXCEPTION 'bad kind';
END $$;
REVOKE ALL ON FUNCTION public.my_profile(text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_profile(text,text) TO authenticated;