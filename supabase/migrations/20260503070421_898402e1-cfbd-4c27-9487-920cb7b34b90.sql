
-- =========================================================
-- $RHOZE loyalty / rewards system
-- =========================================================

-- Settings (singleton)
CREATE TABLE public.rhoze_settings (
  id integer PRIMARY KEY DEFAULT 1,
  earn_per_dollar numeric NOT NULL DEFAULT 10,            -- $RHOZE per $1 spent
  bonus_first_project integer NOT NULL DEFAULT 500,
  reward_event_attended integer NOT NULL DEFAULT 250,
  reward_referral integer NOT NULL DEFAULT 1000,
  credit_cost_rhoze integer NOT NULL DEFAULT 600,         -- 1 credit = 600 $RHOZE (~$60 if 1 RHOZE = $0.10, vs $75 fiat)
  max_discount_pct integer NOT NULL DEFAULT 50,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
INSERT INTO public.rhoze_settings (id) VALUES (1);

ALTER TABLE public.rhoze_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads rhoze settings"
  ON public.rhoze_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins write rhoze settings"
  ON public.rhoze_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Per-project balance
CREATE TABLE public.rhoze_balances (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  balance bigint NOT NULL DEFAULT 0,
  lifetime_earned bigint NOT NULL DEFAULT 0,
  lifetime_spent bigint NOT NULL DEFAULT 0,
  solana_wallet text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rhoze_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team or project member reads rhoze_balances"
  ON public.rhoze_balances FOR SELECT
  USING (public.is_team_member(auth.uid()) OR public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project member or admin updates wallet"
  ON public.rhoze_balances FOR UPDATE
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_project_member(auth.uid(), project_id))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Admins insert balances"
  ON public.rhoze_balances FOR INSERT
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- Ledger
CREATE TYPE public.rhoze_kind AS ENUM (
  'earn_payment', 'earn_first_project', 'earn_event',
  'earn_referral', 'earn_adjust', 'spend_credits',
  'airdrop_queued', 'airdrop_sent'
);

CREATE TABLE public.rhoze_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  delta bigint NOT NULL,
  kind public.rhoze_kind NOT NULL,
  reason text,
  related_payment_id uuid,
  related_credits integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rhoze_ledger_project ON public.rhoze_ledger(project_id, created_at DESC);

ALTER TABLE public.rhoze_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team or project member reads rhoze_ledger"
  ON public.rhoze_ledger FOR SELECT
  USING (public.is_team_member(auth.uid()) OR public.is_project_member(auth.uid(), project_id));

-- Airdrop queue (admin only)
CREATE TABLE public.rhoze_airdrops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  wallet text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  tx_signature text,
  notes text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_by uuid
);

ALTER TABLE public.rhoze_airdrops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage airdrops"
  ON public.rhoze_airdrops FOR ALL
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Project member reads own airdrops"
  ON public.rhoze_airdrops FOR SELECT
  USING (public.is_project_member(auth.uid(), project_id));

-- =========================================================
-- Helpers
-- =========================================================

-- Internal: ensure a balance row exists for a project
CREATE OR REPLACE FUNCTION public._rhoze_ensure_balance(_project_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rhoze_balances (project_id) VALUES (_project_id)
  ON CONFLICT (project_id) DO NOTHING;
END;
$$;

-- Award $RHOZE (positive delta). Team-only.
CREATE OR REPLACE FUNCTION public.rhoze_award(
  _project_id uuid,
  _amount bigint,
  _kind public.rhoze_kind,
  _reason text DEFAULT NULL,
  _related_payment_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _new_balance bigint;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  PERFORM public._rhoze_ensure_balance(_project_id);

  UPDATE public.rhoze_balances
     SET balance = balance + _amount,
         lifetime_earned = lifetime_earned + _amount,
         updated_at = now()
   WHERE project_id = _project_id
   RETURNING balance INTO _new_balance;

  INSERT INTO public.rhoze_ledger (project_id, delta, kind, reason, related_payment_id, created_by)
  VALUES (_project_id, _amount, _kind, _reason, _related_payment_id, auth.uid());

  RETURN _new_balance;
END;
$$;

-- Redeem $RHOZE for session credits. Team OR the project's client.
CREATE OR REPLACE FUNCTION public.rhoze_redeem_for_credits(
  _project_id uuid,
  _credits integer
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _cost bigint;
  _bal bigint;
  _per integer;
  _new_balance bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_team_member(auth.uid()) OR public.is_project_member(auth.uid(), _project_id)) THEN
    RAISE EXCEPTION 'Not authorized for this project';
  END IF;
  IF _credits <= 0 THEN RAISE EXCEPTION 'Credits must be positive'; END IF;

  SELECT credit_cost_rhoze INTO _per FROM public.rhoze_settings WHERE id = 1;
  _cost := _per::bigint * _credits;

  PERFORM public._rhoze_ensure_balance(_project_id);

  SELECT balance INTO _bal FROM public.rhoze_balances WHERE project_id = _project_id FOR UPDATE;
  IF _bal < _cost THEN RAISE EXCEPTION 'Insufficient $RHOZE balance (need %, have %)', _cost, _bal; END IF;

  UPDATE public.rhoze_balances
     SET balance = balance - _cost,
         lifetime_spent = lifetime_spent + _cost,
         updated_at = now()
   WHERE project_id = _project_id
   RETURNING balance INTO _new_balance;

  UPDATE public.projects
     SET credit_balance = COALESCE(credit_balance, 0) + _credits,
         updated_at = now()
   WHERE id = _project_id;

  INSERT INTO public.rhoze_ledger (project_id, delta, kind, reason, related_credits, created_by)
  VALUES (_project_id, -_cost, 'spend_credits',
          format('Redeemed %s $RHOZE for %s credits', _cost, _credits),
          _credits, auth.uid());

  RETURN _new_balance;
END;
$$;

-- Queue an airdrop (admin only)
CREATE OR REPLACE FUNCTION public.rhoze_queue_airdrop(
  _project_id uuid,
  _amount bigint,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _wallet text;
  _bal bigint;
  _id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  PERFORM public._rhoze_ensure_balance(_project_id);

  SELECT solana_wallet, balance INTO _wallet, _bal
    FROM public.rhoze_balances WHERE project_id = _project_id FOR UPDATE;

  IF _wallet IS NULL OR length(_wallet) < 32 THEN
    RAISE EXCEPTION 'Project has no linked Solana wallet';
  END IF;
  IF _bal < _amount THEN RAISE EXCEPTION 'Insufficient $RHOZE balance'; END IF;

  INSERT INTO public.rhoze_airdrops (project_id, amount, wallet, notes, created_by)
  VALUES (_project_id, _amount, _wallet, _notes, auth.uid())
  RETURNING id INTO _id;

  UPDATE public.rhoze_balances
     SET balance = balance - _amount, updated_at = now()
   WHERE project_id = _project_id;

  INSERT INTO public.rhoze_ledger (project_id, delta, kind, reason, created_by)
  VALUES (_project_id, -_amount, 'airdrop_queued',
          format('Airdrop queued to %s', _wallet), auth.uid());

  RETURN _id;
END;
$$;

-- =========================================================
-- Auto-earn trigger on project_payments
-- =========================================================
CREATE OR REPLACE FUNCTION public._rhoze_on_payment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _per numeric;
  _bonus integer;
  _award bigint;
  _is_first boolean;
BEGIN
  IF NEW.amount_cents IS NULL OR NEW.amount_cents <= 0 THEN RETURN NEW; END IF;
  IF NEW.paid_date IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.kind,'') NOT IN ('topup','deposit','milestone','manual') THEN RETURN NEW; END IF;

  SELECT earn_per_dollar, bonus_first_project INTO _per, _bonus
    FROM public.rhoze_settings WHERE id = 1;

  PERFORM public._rhoze_ensure_balance(NEW.project_id);

  _award := floor((NEW.amount_cents::numeric / 100) * _per)::bigint;

  IF _award > 0 THEN
    UPDATE public.rhoze_balances
       SET balance = balance + _award,
           lifetime_earned = lifetime_earned + _award,
           updated_at = now()
     WHERE project_id = NEW.project_id;

    INSERT INTO public.rhoze_ledger (project_id, delta, kind, reason, related_payment_id)
    VALUES (NEW.project_id, _award, 'earn_payment',
            format('+%s $RHOZE for $%s payment', _award, (NEW.amount_cents::numeric/100)::text),
            NEW.id);
  END IF;

  -- First-project bonus: if this is the first paid payment ever for this project
  SELECT NOT EXISTS (
    SELECT 1 FROM public.rhoze_ledger
     WHERE project_id = NEW.project_id AND kind = 'earn_first_project'
  ) INTO _is_first;

  IF _is_first AND _bonus > 0 THEN
    UPDATE public.rhoze_balances
       SET balance = balance + _bonus,
           lifetime_earned = lifetime_earned + _bonus,
           updated_at = now()
     WHERE project_id = NEW.project_id;

    INSERT INTO public.rhoze_ledger (project_id, delta, kind, reason, related_payment_id)
    VALUES (NEW.project_id, _bonus, 'earn_first_project',
            'First-project bonus', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rhoze_on_payment
AFTER INSERT ON public.project_payments
FOR EACH ROW EXECUTE FUNCTION public._rhoze_on_payment();

-- Grants so anon/authenticated can call the helpers
GRANT EXECUTE ON FUNCTION public.rhoze_award(uuid,bigint,public.rhoze_kind,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rhoze_redeem_for_credits(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rhoze_queue_airdrop(uuid,bigint,text) TO authenticated;
