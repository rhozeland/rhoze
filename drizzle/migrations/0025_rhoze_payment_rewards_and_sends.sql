CREATE OR REPLACE FUNCTION public.rz_award_project_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE payer uuid;
BEGIN
  SELECT user_id INTO payer FROM public.releases WHERE id = NEW.release_id;
  IF payer IS NOT NULL AND NEW.amount_cents >= 100 THEN
    INSERT INTO public.user_rewards_ledger (user_id, kind, amount, ref_id, reason)
    VALUES (payer, 'project_payment', (NEW.amount_cents / 100)::bigint, NEW.id, 'Paid toward a project')
    ON CONFLICT (user_id, kind, ref_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_rz_award_project_payment ON public.release_payments;
CREATE TRIGGER trg_rz_award_project_payment AFTER INSERT ON public.release_payments
  FOR EACH ROW EXECUTE FUNCTION public.rz_award_project_payment();

CREATE TABLE public.rhoze_send_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  wallet text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','rejected')),
  tx_signature text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
GRANT SELECT ON public.rhoze_send_requests TO authenticated;
GRANT ALL ON public.rhoze_send_requests TO service_role;
ALTER TABLE public.rhoze_send_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins read send requests" ON public.rhoze_send_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX rhoze_send_requests_status_idx ON public.rhoze_send_requests(status, created_at);

CREATE OR REPLACE FUNCTION public.request_rhoze_send(p_amount bigint, p_wallet text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal bigint; rid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  IF p_wallet !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' THEN RAISE EXCEPTION 'invalid wallet'; END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text));
  SELECT coalesce(sum(amount),0) INTO bal FROM public.user_rewards_ledger WHERE user_id = auth.uid();
  IF p_amount > bal THEN RAISE EXCEPTION 'insufficient balance'; END IF;
  INSERT INTO public.rhoze_send_requests(user_id, amount, wallet) VALUES (auth.uid(), p_amount, p_wallet) RETURNING id INTO rid;
  INSERT INTO public.user_rewards_ledger(user_id, kind, amount, ref_id, reason)
  VALUES (auth.uid(), 'send_request', -p_amount, rid, 'Requested $RHOZE to wallet');
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.admin_decide_rhoze_send(p_id uuid, p_approve boolean, p_tx text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rhoze_send_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT * INTO r FROM public.rhoze_send_requests WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL OR r.status <> 'pending' THEN RAISE EXCEPTION 'not pending'; END IF;
  IF p_approve THEN
    IF coalesce(p_tx,'') !~ '^[1-9A-HJ-NP-Za-km-z]{64,90}$' THEN RAISE EXCEPTION 'transaction signature required'; END IF;
    UPDATE public.rhoze_send_requests SET status='sent', tx_signature=p_tx, note=left(p_note,300), decided_at=now() WHERE id=p_id;
  ELSE
    UPDATE public.rhoze_send_requests SET status='rejected', note=left(p_note,300), decided_at=now() WHERE id=p_id;
    INSERT INTO public.user_rewards_ledger(user_id, kind, amount, ref_id, reason)
    VALUES (r.user_id, 'send_refund', r.amount, r.id, 'Send request declined — returned')
    ON CONFLICT (user_id, kind, ref_id) DO NOTHING;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.request_rhoze_send(bigint, text), public.admin_decide_rhoze_send(uuid, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_rhoze_send(bigint, text), public.admin_decide_rhoze_send(uuid, boolean, text, text) TO authenticated;