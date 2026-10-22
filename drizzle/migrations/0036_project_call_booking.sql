ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS release_id uuid, ADD COLUMN IF NOT EXISTS user_id uuid, ADD COLUMN IF NOT EXISTS paid_credits integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.my_call_credits()
RETURNS TABLE(balance_credits bigint, call_cost integer, rhoze_per_credit integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (coalesce((SELECT sum(amount) FROM user_rewards_ledger WHERE user_id = auth.uid()),0)
          / greatest((SELECT credit_cost_rhoze FROM rhoze_settings WHERE id=1),1))::bigint,
         1, (SELECT credit_cost_rhoze FROM rhoze_settings WHERE id=1)
  WHERE auth.uid() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.book_project_call(_release_id uuid, _slot_start timestamptz, _pay_with_credits boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r releases; _id uuid := gen_random_uuid(); _per int; _bal bigint; _email text; _cost int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to book a call'; END IF;
  SELECT * INTO _r FROM releases WHERE id = _release_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Not your project'; END IF;
  IF _slot_start < now() + interval '23 hours' OR _slot_start > now() + interval '32 days'
     OR extract(minute FROM _slot_start)::int % 20 <> 0 OR extract(second FROM _slot_start) <> 0 THEN
    RAISE EXCEPTION 'That time is not available';
  END IF;
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  IF _pay_with_credits THEN
    SELECT credit_cost_rhoze INTO _per FROM rhoze_settings WHERE id = 1;
    PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text));
    SELECT coalesce(sum(amount),0) INTO _bal FROM user_rewards_ledger WHERE user_id = auth.uid();
    IF _bal < _per THEN RAISE EXCEPTION 'Not enough credits'; END IF;
    _cost := 1;
  END IF;
  UPDATE bookings SET status = 'cancelled', updated_at = now()
   WHERE release_id = _release_id AND user_id = auth.uid() AND status <> 'cancelled';
  -- refund credits from any replaced paid call
  INSERT INTO user_rewards_ledger(user_id, kind, amount, ref_id, reason)
  SELECT auth.uid(), 'refund_call', b.paid_credits * _per_fallback.p, b.id, 'Call rescheduled'
  FROM bookings b, (SELECT credit_cost_rhoze p FROM rhoze_settings WHERE id=1) _per_fallback
  WHERE b.release_id = _release_id AND b.user_id = auth.uid() AND b.status='cancelled' AND b.paid_credits > 0
  ON CONFLICT DO NOTHING;
  BEGIN
    INSERT INTO bookings(id, name, email, slot_start, slot_end, notes, status, release_id, user_id, paid_credits)
    VALUES (_id, coalesce(nullif(_r.creator_name,''),'Rhozeland creator'), coalesce(_email,''), _slot_start, _slot_start + interval '20 minutes',
            'Project call: ' || coalesce(_r.title,''), 'confirmed', _release_id, auth.uid(), _cost);
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'That time was just taken';
  END;
  IF _cost > 0 THEN
    INSERT INTO user_rewards_ledger(user_id, kind, amount, ref_id, reason)
    VALUES (auth.uid(), 'spend_call', -_per, _id, 'Booked a project call');
  END IF;
  UPDATE releases SET booking_id = _id, updated_at = now() WHERE id = _release_id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.my_project_calls()
RETURNS TABLE(release_id uuid, booking_id uuid, slot_start timestamptz, slot_end timestamptz, paid_credits integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.release_id, b.id, b.slot_start, b.slot_end, b.paid_credits FROM bookings b
  WHERE auth.uid() IS NOT NULL AND b.user_id = auth.uid() AND b.status <> 'cancelled' AND b.release_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.book_project_call(uuid,timestamptz,boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.my_call_credits() FROM public, anon;
REVOKE ALL ON FUNCTION public.my_project_calls() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.book_project_call(uuid,timestamptz,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_call_credits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_project_calls() TO authenticated;