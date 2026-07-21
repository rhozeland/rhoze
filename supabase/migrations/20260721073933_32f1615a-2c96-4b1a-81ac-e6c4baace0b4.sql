
REVOKE SELECT ON public.service_packages FROM anon, authenticated, PUBLIC;
GRANT SELECT (id, slug, name, kind, description, price_cents, credits, billing_interval, is_active, sort_order, created_at, updated_at, category, credits_cost, min_quantity) ON public.service_packages TO anon, authenticated;
GRANT ALL ON public.service_packages TO service_role;

ALTER VIEW public.community_avatars SET (security_invoker = on);
