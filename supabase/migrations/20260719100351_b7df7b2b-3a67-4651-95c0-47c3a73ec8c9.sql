REVOKE ALL ON FUNCTION public.apply_project_topup(uuid, integer, integer, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_project_topup(_project_id uuid, _dollar_cents integer, _credits integer, _label text, _stripe_session_id text, _stripe_payment_intent_id text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _exists boolean;
BEGIN
  -- Only the service role (Stripe webhook) may credit balances. auth.role() is
  -- 'service_role' when called with the service key; anon/authenticated JWTs
  -- resolve to their respective roles and are rejected.
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _project_id IS NULL THEN RETURN; END IF;

  -- Require a Stripe session id so credits are always tied to a real payment
  -- and the idempotency check below is meaningful.
  IF _stripe_session_id IS NULL OR length(trim(_stripe_session_id)) = 0 THEN
    RAISE EXCEPTION 'Stripe session id required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.project_payments
    WHERE stripe_session_id = _stripe_session_id
  ) INTO _exists;
  IF _exists THEN RETURN; END IF;

  UPDATE public.projects
     SET dollar_balance_cents = COALESCE(dollar_balance_cents, 0) + COALESCE(_dollar_cents, 0),
         credit_balance       = COALESCE(credit_balance, 0)       + COALESCE(_credits, 0),
         updated_at           = now()
   WHERE id = _project_id;

  INSERT INTO public.project_payments (
    project_id, label, amount_cents, paid_date, method, kind,
    stripe_session_id, stripe_payment_intent_id, notes
  ) VALUES (
    _project_id,
    COALESCE(_label, 'Top-up'),
    COALESCE(_dollar_cents, 0),
    CURRENT_DATE,
    'card',
    'topup',
    _stripe_session_id,
    _stripe_payment_intent_id,
    CASE WHEN _credits > 0 THEN format('+%s session credits', _credits) ELSE NULL END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_project_topup(uuid, integer, integer, text, text, text) FROM PUBLIC, anon, authenticated;