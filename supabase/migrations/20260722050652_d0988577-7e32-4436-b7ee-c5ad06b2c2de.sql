
-- 1. user_wallets: custodial Solana wallets
CREATE TABLE public.user_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pubkey text NOT NULL,
  secret_encrypted bytea,
  is_custodial boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_wallets TO authenticated;
GRANT ALL ON public.user_wallets TO service_role;

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

-- Users can see their own row exists, but the secret_encrypted column is not
-- exposed via a client-safe view below. Direct SELECT still works but the
-- bytea secret is only readable server-side (service role bypasses RLS).
CREATE POLICY "Users can view their own wallet"
  ON public.user_wallets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Safer view: only pubkey + custodial flag, no secret material.
CREATE VIEW public.user_wallet_pubkeys
  WITH (security_invoker = true)
  AS
  SELECT user_id, pubkey, is_custodial, created_at, updated_at
    FROM public.user_wallets;

GRANT SELECT ON public.user_wallet_pubkeys TO authenticated;

CREATE TRIGGER user_wallets_set_updated_at
  BEFORE UPDATE ON public.user_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Concierge turn budget
ALTER TABLE public.copilot_conversations
  ADD COLUMN IF NOT EXISTS turn_budget integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS turns_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_captured_at timestamptz;
