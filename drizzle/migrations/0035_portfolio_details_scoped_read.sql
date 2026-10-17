DROP POLICY IF EXISTS "Public editorial details" ON public.portfolio_details;
CREATE POLICY "Admins read editorial details" ON public.portfolio_details FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
REVOKE SELECT ON public.portfolio_details FROM anon;

-- Public pages read one archive record at a time by slug.
CREATE OR REPLACE FUNCTION public.portfolio_detail(p_slug text)
RETURNS TABLE(slug text, story text, cultural_context text, rhozeland_contribution text, coin_mint text, coin_ticker text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.slug, d.story, d.cultural_context, d.rhozeland_contribution, d.coin_mint, d.coin_ticker
  FROM public.portfolio_details d WHERE d.slug = p_slug LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.portfolio_detail(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portfolio_detail(text) TO anon, authenticated;