-- Allow anonymous post-checkout pages to look up the project code created by a Stripe checkout session.
-- Only returns the code, the project id and the contact email — never the rest of the project row.
CREATE OR REPLACE FUNCTION public.get_checkout_outcome(_session_id text)
RETURNS TABLE(project_id uuid, project_code text, contact_email text, kind text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- One-off / deposit checkout → joined through intake_requests
  SELECT p.id, p.project_code, ir.contact_email, 'one_time'::text
  FROM public.intake_requests ir
  LEFT JOIN public.projects p ON p.id = ir.project_id
  WHERE ir.stripe_session_id = _session_id
  UNION ALL
  -- Subscription checkout → look up by stripe_subscription_id was not stored on session; fall back none
  SELECT NULL::uuid, NULL::text, NULL::text, 'subscription'::text
  WHERE FALSE
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_checkout_outcome(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_outcome(text) TO anon, authenticated;