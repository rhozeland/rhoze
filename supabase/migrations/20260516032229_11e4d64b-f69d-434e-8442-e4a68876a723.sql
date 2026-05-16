
-- ============ BOOKINGS ============
-- Drop the overly-permissive anon SELECT policy that exposed PII
DROP POLICY IF EXISTS "Anyone reads slot availability" ON public.bookings;

-- Team members (and admins) can read all booking rows
CREATE POLICY "Team reads all bookings"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()));

-- Public view: only slot timing + status, no PII
CREATE OR REPLACE VIEW public.booking_slots
  WITH (security_invoker = false) AS
SELECT slot_start, slot_end, status, timezone
FROM public.bookings
WHERE status <> 'cancelled';

GRANT SELECT ON public.booking_slots TO anon, authenticated;

-- ============ PROFILES ============
-- Replace the "any authenticated user can read everything" policy
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;

-- Team members can read every profile; non-team users can only read their own
CREATE POLICY "Profiles readable by team or self"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_team_member(auth.uid()));
