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
    current_step = GREATEST(1, LEAST(4, COALESCE((p_data->>'current_step')::int, 1))),
    user_id = COALESCE(user_id, auth.uid())
  WHERE id = v_id;
  RETURN v_id;
END $$;