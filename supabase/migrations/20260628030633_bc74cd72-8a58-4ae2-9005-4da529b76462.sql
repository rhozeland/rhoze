REVOKE SELECT (stripe_price_id) ON public.service_packages FROM anon, authenticated;
GRANT SELECT (stripe_price_id) ON public.service_packages TO service_role;