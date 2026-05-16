
DROP VIEW IF EXISTS public.booking_slots;

CREATE OR REPLACE FUNCTION public.list_busy_slots(_from timestamptz DEFAULT now() - interval '1 day')
RETURNS TABLE(slot_start timestamptz, slot_end timestamptz, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.slot_start, b.slot_end, b.status
  FROM public.bookings b
  WHERE b.status <> 'cancelled'
    AND b.slot_start >= _from;
$$;

REVOKE EXECUTE ON FUNCTION public.list_busy_slots(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_busy_slots(timestamptz) TO anon, authenticated;
