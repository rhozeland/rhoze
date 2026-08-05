CREATE TABLE public.rhoze_onchain_trades (
  sig text PRIMARY KEY,
  ts timestamptz NOT NULL,
  side text NOT NULL,
  tokens numeric NOT NULL,
  sol numeric NOT NULL,
  price_usd numeric NOT NULL,
  value_usd numeric NOT NULL,
  trader text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rhoze_onchain_trades_ts_idx ON public.rhoze_onchain_trades (ts DESC);
GRANT SELECT ON public.rhoze_onchain_trades TO anon;
GRANT SELECT ON public.rhoze_onchain_trades TO authenticated;
GRANT ALL ON public.rhoze_onchain_trades TO service_role;
ALTER TABLE public.rhoze_onchain_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public market data is readable by everyone"
  ON public.rhoze_onchain_trades FOR SELECT
  USING (true);