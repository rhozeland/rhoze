ALTER TABLE public.campaign_state
  ADD COLUMN IF NOT EXISTS graduated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS graduated_at timestamptz,
  ADD COLUMN IF NOT EXISTS square_checkout_url text,
  ADD COLUMN IF NOT EXISTS dex_url text;

UPDATE public.campaign_state
SET graduated = true,
    graduated_at = COALESCE(graduated_at, now()),
    remaining_sol = 0,
    headline = COALESCE(NULLIF(headline, ''), 'We graduated. Now own a piece.'),
    subhead = 'The bonding curve is complete — $RHOZE is live on the open market.',
    updated_at = now()
WHERE id = 1;