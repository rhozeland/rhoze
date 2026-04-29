-- ============= Subscriptions table =============
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  pending_price_id text,
  environment text NOT NULL DEFAULT 'sandbox',
  project_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_project_id ON public.subscriptions(project_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id OR is_team_member(auth.uid()));

CREATE POLICY "Service role manages subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= service_packages: link to Stripe =============
-- stripe_price_id already exists; seed values for the items we created in Stripe.
UPDATE public.service_packages SET stripe_price_id = 'tier_bronze_monthly'   WHERE slug = 'bronze';
UPDATE public.service_packages SET stripe_price_id = 'tier_gold_monthly'     WHERE slug = 'gold';
UPDATE public.service_packages SET stripe_price_id = 'tier_diamond_monthly'  WHERE slug = 'diamond';
UPDATE public.service_packages SET stripe_price_id = 'alc_studio_rental_one'   WHERE slug = 'studio-rental';
UPDATE public.service_packages SET stripe_price_id = 'alc_audio_recording_one' WHERE slug = 'audio-recording';
UPDATE public.service_packages SET stripe_price_id = 'alc_mixing_one'          WHERE slug = 'mixing';
UPDATE public.service_packages SET stripe_price_id = 'alc_mastering_one'       WHERE slug = 'mastering';
UPDATE public.service_packages SET stripe_price_id = 'alc_mv_edit_one'         WHERE slug = 'mv-edit';
UPDATE public.service_packages SET stripe_price_id = 'alc_photo_shoot_one'     WHERE slug = 'photo-shoot';
UPDATE public.service_packages SET stripe_price_id = 'alc_podcast_one'         WHERE slug = 'podcast';
UPDATE public.service_packages SET stripe_price_id = 'alc_design_one'          WHERE slug = 'design';
UPDATE public.service_packages SET stripe_price_id = 'alc_consult_one'         WHERE slug = 'consult';

-- ============= projects: lifecycle columns =============
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_tier_slug text,
  ADD COLUMN IF NOT EXISTS pending_change_at timestamptz,
  ADD COLUMN IF NOT EXISTS active_tier_slug text;

-- Backfill active_tier_slug from existing package_id where possible
UPDATE public.projects p
   SET active_tier_slug = sp.slug
  FROM public.service_packages sp
 WHERE p.package_id = sp.id AND p.active_tier_slug IS NULL;

-- ============= project_payments: checkout linkage =============
ALTER TABLE public.project_payments
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'manual';

-- ============= intake_requests: paid status =============
ALTER TABLE public.intake_requests
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_cents integer NOT NULL DEFAULT 0;

-- ============= Helper functions =============

-- apply_tier_credits: add a tier's monthly credits to a project
CREATE OR REPLACE FUNCTION public.apply_tier_credits(_project_id uuid, _tier_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _credits integer;
BEGIN
  SELECT credits INTO _credits FROM public.service_packages
   WHERE slug = _tier_slug AND kind = 'subscription' LIMIT 1;
  IF _credits IS NULL THEN RETURN; END IF;
  UPDATE public.projects
     SET credit_balance = COALESCE(credit_balance, 0) + _credits,
         active_tier_slug = _tier_slug
   WHERE id = _project_id;
END;
$$;

-- archive_expired_projects: flip canceled projects to archived once period ends
CREATE OR REPLACE FUNCTION public.archive_expired_projects()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer := 0;
BEGIN
  WITH expired AS (
    SELECT s.project_id
      FROM public.subscriptions s
     WHERE s.status = 'canceled'
       AND s.current_period_end IS NOT NULL
       AND s.current_period_end <= now()
       AND s.project_id IS NOT NULL
  )
  UPDATE public.projects p
     SET status = 'archived',
         archived_at = COALESCE(p.archived_at, now())
    FROM expired e
   WHERE p.id = e.project_id
     AND p.status <> 'archived';
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- apply_pending_tier_changes: at the start of a new billing cycle, swap any queued tier
CREATE OR REPLACE FUNCTION public.apply_pending_tier_change(_subscription_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_id uuid;
  _new_slug text;
BEGIN
  SELECT s.project_id, p.pending_tier_slug
    INTO _project_id, _new_slug
    FROM public.subscriptions s
    JOIN public.projects p ON p.id = s.project_id
   WHERE s.id = _subscription_id;
  IF _project_id IS NULL OR _new_slug IS NULL THEN RETURN; END IF;
  UPDATE public.projects
     SET active_tier_slug = _new_slug,
         pending_tier_slug = NULL,
         pending_change_at = NULL
   WHERE id = _project_id;
  PERFORM public.apply_tier_credits(_project_id, _new_slug);
END;
$$;

-- has_active_subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'sandbox')
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
     WHERE user_id = user_uuid
       AND environment = check_env
       AND (
         (status IN ('active','trialing','past_due') AND (current_period_end IS NULL OR current_period_end > now()))
         OR (status = 'canceled' AND current_period_end > now())
       )
  );
$$;

-- create_project_from_intake: webhook helper for à la carte / deposit flow
-- Returns project id (creates a project shell when a deposit is paid)
CREATE OR REPLACE FUNCTION public.create_project_from_intake(_intake_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _intake public.intake_requests%ROWTYPE;
  _project_id uuid;
  _code text;
BEGIN
  SELECT * INTO _intake FROM public.intake_requests WHERE id = _intake_id;
  IF _intake IS NULL THEN RAISE EXCEPTION 'intake not found'; END IF;
  IF _intake.project_id IS NOT NULL THEN RETURN _intake.project_id; END IF;

  -- generate a project code
  _code := 'RHZ-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4))
        || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));

  INSERT INTO public.projects (
    title, client_name, client_email, client_phone, status,
    dollar_balance_cents, project_code, notes
  ) VALUES (
    'Project for ' || _intake.contact_name,
    _intake.contact_name, _intake.contact_email, _intake.contact_phone,
    'active', _intake.deposit_cents, _code,
    _intake.message
  ) RETURNING id INTO _project_id;

  UPDATE public.intake_requests
     SET project_id = _project_id,
         status = 'converted',
         paid_at = now()
   WHERE id = _intake_id;

  RETURN _project_id;
END;
$$;