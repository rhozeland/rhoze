
-- ============ campaign_state ============
CREATE TABLE public.campaign_state (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  remaining_sol NUMERIC NOT NULL DEFAULT 45.30,
  sol_price_usd NUMERIC NOT NULL DEFAULT 78,
  total_target_sol NUMERIC NOT NULL DEFAULT 85,
  campaign_open BOOLEAN NOT NULL DEFAULT true,
  window_ends_at TIMESTAMPTZ,
  headline TEXT DEFAULT 'Help graduate $RHOZE',
  subhead TEXT DEFAULT 'Real people bonding a real ecosystem.',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT campaign_state_singleton CHECK (id = 1)
);
GRANT SELECT ON public.campaign_state TO anon, authenticated;
GRANT ALL ON public.campaign_state TO service_role;
ALTER TABLE public.campaign_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign_state public read" ON public.campaign_state FOR SELECT USING (true);
CREATE POLICY "campaign_state team update" ON public.campaign_state FOR UPDATE
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "campaign_state team insert" ON public.campaign_state FOR INSERT
  WITH CHECK (public.is_team_member(auth.uid()));
INSERT INTO public.campaign_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============ investor_pledges ============
CREATE TYPE public.pledge_tier AS ENUM ('supporter','builder','core');
CREATE TYPE public.pledge_path AS ENUM ('self_serve','assisted');
CREATE TYPE public.pledge_status AS ENUM ('pending','confirmed','settled','fulfilled','cancelled');
CREATE TYPE public.pledge_payment AS ENUM ('square','etransfer','sol','usdc','other');

CREATE TABLE public.investor_pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_usd_cents BIGINT NOT NULL CHECK (amount_usd_cents > 0),
  tier public.pledge_tier NOT NULL,
  lock_months SMALLINT NOT NULL DEFAULT 0 CHECK (lock_months IN (0,1,3,6,12)),
  path public.pledge_path NOT NULL DEFAULT 'assisted',
  service_fee_cents BIGINT NOT NULL DEFAULT 0,
  credit_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  payment_method public.pledge_payment NOT NULL DEFAULT 'square',
  solana_wallet TEXT,
  notes TEXT,
  status public.pledge_status NOT NULL DEFAULT 'pending',
  tx_signature TEXT,
  settled_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  credits_awarded BIGINT NOT NULL DEFAULT 0,
  awarded_project_id UUID REFERENCES public.projects(id),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX investor_pledges_user_idx ON public.investor_pledges(user_id);
CREATE INDEX investor_pledges_status_idx ON public.investor_pledges(status);

GRANT SELECT, INSERT ON public.investor_pledges TO authenticated;
GRANT UPDATE, DELETE ON public.investor_pledges TO authenticated;
GRANT ALL ON public.investor_pledges TO service_role;

ALTER TABLE public.investor_pledges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pledges self read" ON public.investor_pledges FOR SELECT
  USING (auth.uid() = user_id OR public.is_team_member(auth.uid()));
CREATE POLICY "pledges self insert" ON public.investor_pledges FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pledges self cancel" ON public.investor_pledges FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pledges team update" ON public.investor_pledges FOR UPDATE
  USING (public.is_team_member(auth.uid()))
  WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "pledges admin delete" ON public.investor_pledges FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER investor_pledges_updated_at BEFORE UPDATE ON public.investor_pledges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RPC: create_investor_pledge ============
CREATE OR REPLACE FUNCTION public.create_investor_pledge(
  _amount_usd_cents BIGINT,
  _lock_months SMALLINT,
  _path public.pledge_path,
  _payment_method public.pledge_payment,
  _solana_wallet TEXT DEFAULT NULL,
  _notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _tier public.pledge_tier;
  _base_mult NUMERIC(4,2);
  _lock_bonus NUMERIC(4,2);
  _mult NUMERIC(4,2);
  _fee BIGINT := 0;
  _id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount_usd_cents < 5000 THEN RAISE EXCEPTION 'Minimum pledge is $50'; END IF;

  IF _amount_usd_cents >= 200000 THEN _tier := 'core'; _base_mult := 1.40;
  ELSIF _amount_usd_cents >= 50000 THEN _tier := 'builder'; _base_mult := 1.15;
  ELSE _tier := 'supporter'; _base_mult := 1.00;
  END IF;

  _lock_bonus := CASE _lock_months
    WHEN 0 THEN 0.00 WHEN 1 THEN 0.05 WHEN 3 THEN 0.10 WHEN 6 THEN 0.20 WHEN 12 THEN 0.35
    ELSE 0.00 END;
  _mult := _base_mult + _lock_bonus;

  IF _path = 'assisted' THEN _fee := (_amount_usd_cents * 7) / 100; END IF;

  INSERT INTO public.investor_pledges (
    user_id, amount_usd_cents, tier, lock_months, path,
    service_fee_cents, credit_multiplier, payment_method, solana_wallet, notes
  ) VALUES (
    _uid, _amount_usd_cents, _tier, _lock_months, _path,
    _fee, _mult, _payment_method, _solana_wallet, _notes
  ) RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_investor_pledge(BIGINT, SMALLINT, public.pledge_path, public.pledge_payment, TEXT, TEXT) TO authenticated;

-- ============ RPC: admin_fulfill_investor_pledge ============
CREATE OR REPLACE FUNCTION public.admin_fulfill_investor_pledge(
  _pledge_id UUID,
  _project_id UUID,
  _tx_signature TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _p public.investor_pledges%ROWTYPE;
  _credits BIGINT;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'Team only'; END IF;
  SELECT * INTO _p FROM public.investor_pledges WHERE id = _pledge_id FOR UPDATE;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Pledge not found'; END IF;
  IF _p.status = 'fulfilled' THEN RAISE EXCEPTION 'Already fulfilled'; END IF;

  _credits := floor((_p.amount_usd_cents::numeric / 100) * _p.credit_multiplier)::BIGINT;

  PERFORM public.rhoze_award(_project_id, _credits, 'manual'::rhoze_kind,
    format('Investor pledge %s ($%s @ %sx)', _p.id, (_p.amount_usd_cents/100.0)::text, _p.credit_multiplier::text),
    NULL);

  UPDATE public.investor_pledges
     SET status = 'fulfilled',
         fulfilled_at = now(),
         credits_awarded = _credits,
         awarded_project_id = _project_id,
         tx_signature = COALESCE(_tx_signature, tx_signature)
   WHERE id = _pledge_id;

  RETURN _credits;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_fulfill_investor_pledge(UUID, UUID, TEXT) TO authenticated;
