CREATE TABLE public.portfolio_details (
  slug text PRIMARY KEY,
  story text NOT NULL DEFAULT '',
  cultural_context text NOT NULL DEFAULT '',
  rhozeland_contribution text NOT NULL DEFAULT '',
  coin_mint text NOT NULL DEFAULT '',
  coin_ticker text NOT NULL DEFAULT '',
  CONSTRAINT portfolio_slug_valid CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT portfolio_mint_valid CHECK (coin_mint = '' OR coin_mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$')
);
GRANT SELECT ON public.portfolio_details TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_details TO authenticated;
GRANT ALL ON public.portfolio_details TO service_role;
ALTER TABLE public.portfolio_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public editorial details" ON public.portfolio_details FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin editorial insert" ON public.portfolio_details FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin editorial update" ON public.portfolio_details FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin editorial delete" ON public.portfolio_details FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
COMMENT ON TABLE public.portfolio_details IS 'Public editorial context and optional token pairing for static portfolio archive records. Admin-only writes; no account ownership inferred from artist names.';