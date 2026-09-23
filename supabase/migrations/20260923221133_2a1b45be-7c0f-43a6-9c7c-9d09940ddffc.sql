CREATE TABLE public.releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  owner_token text NOT NULL,
  user_id uuid,
  booking_id uuid,
  status text NOT NULL DEFAULT 'draft',
  current_step smallint NOT NULL DEFAULT 1,
  title text NOT NULL DEFAULT '',
  creator_name text NOT NULL DEFAULT '',
  creator_email text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  budget_cents bigint NOT NULL DEFAULT 0,
  artist_pct numeric NOT NULL DEFAULT 80,
  fee_pct numeric NOT NULL DEFAULT 10,
  cause_pct numeric NOT NULL DEFAULT 10,
  cause_name text,
  milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  coin_mint text,
  coin_ticker text,
  coin_name text,
  coin_image text,
  payout_wallet text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.releases TO anon, authenticated;
GRANT ALL ON public.releases TO service_role;
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published releases are public" ON public.releases FOR SELECT USING (status = 'published');
CREATE POLICY "Team can view all releases" ON public.releases FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
-- Hide owner_token from public reads
REVOKE SELECT (owner_token) ON public.releases FROM anon, authenticated;

CREATE TRIGGER releases_updated_at BEFORE UPDATE ON public.releases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.release_save(p_token text, p_id uuid, p_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_budget bigint; v_a numeric; v_f numeric; v_c numeric;
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
    SELECT id INTO v_id FROM releases WHERE id = p_id AND owner_token = p_token;
    IF v_id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
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
    payout_wallet = left(NULLIF(p_data->>'payout_wallet',''), 64),
    current_step = GREATEST(1, LEAST(3, COALESCE((p_data->>'current_step')::int, 1))),
    user_id = COALESCE(user_id, auth.uid())
  WHERE id = v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.release_get_draft(p_token text, p_id uuid)
RETURNS SETOF public.releases LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM releases WHERE id = p_id AND owner_token = p_token;
$$;

CREATE OR REPLACE FUNCTION public.release_publish(p_token text, p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r releases; v_base text; v_slug text; n int := 0;
BEGIN
  SELECT * INTO r FROM releases WHERE id = p_id AND owner_token = p_token;
  IF r.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF length(trim(r.title)) = 0 THEN RAISE EXCEPTION 'title required'; END IF;
  IF jsonb_array_length(r.milestones) = 0 THEN RAISE EXCEPTION 'add at least one milestone'; END IF;
  IF r.slug IS NOT NULL THEN
    UPDATE releases SET status='published', published_at = COALESCE(published_at, now()) WHERE id = r.id;
    RETURN r.slug;
  END IF;
  v_base := trim(both '-' from regexp_replace(lower(r.title), '[^a-z0-9]+', '-', 'g'));
  IF v_base = '' THEN v_base := 'project'; END IF;
  v_base := left(v_base, 48);
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM releases WHERE slug = v_slug) LOOP
    n := n + 1; v_slug := v_base || '-' || substr(md5(random()::text), 1, 4);
    IF n > 10 THEN RAISE EXCEPTION 'slug collision'; END IF;
  END LOOP;
  UPDATE releases SET slug = v_slug, status='published', published_at = now() WHERE id = r.id;
  RETURN v_slug;
END $$;

GRANT EXECUTE ON FUNCTION public.release_save(text, uuid, jsonb), public.release_get_draft(text, uuid), public.release_publish(text, uuid) TO anon, authenticated;