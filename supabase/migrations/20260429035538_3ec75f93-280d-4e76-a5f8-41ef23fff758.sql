
-- Referral codes table
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  role app_role NOT NULL DEFAULT 'employee',
  note text,
  max_uses integer NOT NULL DEFAULT 1,
  uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage referral codes"
  ON public.referral_codes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Validate (read-only) a referral code; returns role if valid, else null
CREATE OR REPLACE FUNCTION public.validate_referral_code(_code text)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.referral_codes
  WHERE code = _code
    AND is_active = true
    AND uses < max_uses
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1
$$;

-- Consume a referral code for the calling user: assigns role and increments uses.
-- Called by the newly-signed-up user immediately after signup.
CREATE OR REPLACE FUNCTION public.consume_referral_code(_code text)
RETURNS app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO _role FROM public.referral_codes
  WHERE code = _code
    AND is_active = true
    AND uses < max_uses
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE
  LIMIT 1;

  IF _role IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired referral code';
  END IF;

  UPDATE public.referral_codes
    SET uses = uses + 1
  WHERE code = _code;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _role;
END;
$$;
