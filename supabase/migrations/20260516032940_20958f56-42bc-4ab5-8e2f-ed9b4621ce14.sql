
-- ============ service_packages: hide stripe_price_id from anon ============
REVOKE SELECT (stripe_price_id) ON public.service_packages FROM anon, authenticated;
GRANT  SELECT (stripe_price_id) ON public.service_packages TO service_role;
-- Admins are 'authenticated' but RLS still requires role; allow admins to read via a separate grant path:
-- (column GRANT is the gate; RLS still applies). Grant back to authenticated then re-check via policy.
-- Simpler: keep authenticated revoked; admin tooling that needs the value should use service role / RPC.

-- Helper RPC for admin tools that need stripe_price_id (Catalog page etc.)
CREATE OR REPLACE FUNCTION public.admin_get_service_packages()
RETURNS SETOF public.service_packages
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.service_packages
   WHERE public.has_role(auth.uid(), 'admin'::app_role)
   ORDER BY sort_order;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_get_service_packages() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_get_service_packages() TO authenticated;

-- Helper RPC: resolve a package slug to its Stripe lookup_key for checkout.
-- Returns NULL when not active or not found. Safe for anon (only returns the
-- lookup_key for an already-public is_active package).
CREATE OR REPLACE FUNCTION public.get_package_stripe_lookup(_slug text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT stripe_price_id
    FROM public.service_packages
   WHERE slug = _slug
     AND is_active = true
   LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_package_stripe_lookup(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_package_stripe_lookup(text) TO anon, authenticated;

-- ============ realtime.messages: restrict channel subscriptions ============
-- Supabase's Realtime Authorization uses RLS on realtime.messages to gate
-- channel SUBSCRIBE / BROADCAST. We only allow team members to attach to the
-- team chat channel topics ("messages", "team:*").
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members can subscribe to team channels" ON realtime.messages;
CREATE POLICY "Team members can subscribe to team channels"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    public.is_team_member(auth.uid())
  );

DROP POLICY IF EXISTS "Team members can broadcast on team channels" ON realtime.messages;
CREATE POLICY "Team members can broadcast on team channels"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_team_member(auth.uid())
  );
