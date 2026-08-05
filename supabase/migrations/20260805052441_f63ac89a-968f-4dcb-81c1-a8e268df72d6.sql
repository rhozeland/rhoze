CREATE OR REPLACE FUNCTION public.ensure_personal_project(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pid uuid;
  _name text;
  _email text;
BEGIN
  SELECT pc.project_id INTO _pid
    FROM public.project_clients pc
    JOIN public.projects p ON p.id = pc.project_id
   WHERE pc.user_id = _user_id
   ORDER BY p.created_at ASC
   LIMIT 1;
  IF _pid IS NOT NULL THEN RETURN _pid; END IF;

  SELECT display_name, email INTO _name, _email FROM public.profiles WHERE id = _user_id;

  INSERT INTO public.projects (title, client_name, client_email, status)
  VALUES ('Personal account', COALESCE(_name, _email, 'Member'), _email, 'active')
  RETURNING id INTO _pid;

  INSERT INTO public.project_clients (project_id, user_id)
  VALUES (_pid, _user_id)
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN _pid;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_rhoze_square(
  _amount_usd_cents bigint,
  _lock_months smallint DEFAULT 0,
  _solana_wallet text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _square_order_ref text DEFAULT NULL
)
RETURNS TABLE(pledge_id uuid, project_id uuid, credits_awarded bigint, new_balance bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _tier public.pledge_tier;
  _base numeric(4,2);
  _lock numeric(4,2);
  _mult numeric(4,2);
  _fee bigint;
  _credits bigint;
  _pid uuid;
  _plid uuid;
  _bal bigint;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount_usd_cents IS NULL OR _amount_usd_cents < 5000 THEN RAISE EXCEPTION 'Minimum purchase is $50'; END IF;
  IF _amount_usd_cents > 100000000 THEN RAISE EXCEPTION 'Amount too large'; END IF;

  IF _amount_usd_cents >= 200000 THEN _tier := 'core'; _base := 1.40;
  ELSIF _amount_usd_cents >= 50000 THEN _tier := 'builder'; _base := 1.15;
  ELSE _tier := 'supporter'; _base := 1.00;
  END IF;

  _lock := CASE COALESCE(_lock_months, 0::smallint)
    WHEN 0 THEN 0.00 WHEN 1 THEN 0.05 WHEN 3 THEN 0.10 WHEN 6 THEN 0.20 WHEN 12 THEN 0.35
    ELSE 0.00 END;
  _mult := _base + _lock;
  _fee := (_amount_usd_cents * 7) / 100;
  _credits := floor((_amount_usd_cents::numeric / 100) * _mult)::bigint;

  _pid := public.ensure_personal_project(_uid);
  PERFORM public._rhoze_ensure_balance(_pid);

  INSERT INTO public.investor_pledges (
    user_id, amount_usd_cents, tier, lock_months, path,
    service_fee_cents, credit_multiplier, payment_method, solana_wallet, notes,
    status, credits_awarded, awarded_project_id, fulfilled_at, tx_signature
  ) VALUES (
    _uid, _amount_usd_cents, _tier, COALESCE(_lock_months, 0::smallint), 'assisted',
    _fee, _mult, 'square', _solana_wallet, _notes,
    'confirmed', _credits, _pid, now(), _square_order_ref
  ) RETURNING id INTO _plid;

  UPDATE public.rhoze_balances
     SET balance = balance + _credits,
         lifetime_earned = lifetime_earned + _credits,
         updated_at = now()
   WHERE rhoze_balances.project_id = _pid
   RETURNING balance INTO _bal;

  INSERT INTO public.rhoze_ledger (project_id, delta, kind, reason, created_by)
  VALUES (_pid, _credits, 'earn_adjust',
          format('Square purchase $%s @ %sx', (_amount_usd_cents/100.0)::text, _mult::text), _uid);

  RETURN QUERY SELECT _plid, _pid, _credits, _bal;
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_rhoze_square(bigint, smallint, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_rhoze_square(bigint, smallint, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.ensure_personal_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_personal_project(uuid) TO authenticated, service_role;