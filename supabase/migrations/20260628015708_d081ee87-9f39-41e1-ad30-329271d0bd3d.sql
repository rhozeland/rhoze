CREATE OR REPLACE FUNCTION public.community_reset_weekly()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n integer;
BEGIN
  IF NOT public.can_edit_community(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.community_leaderboard
    SET weekly_points = 0,
        last_updated = CURRENT_DATE
  WHERE weekly_points <> 0;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.community_reset_weekly() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.community_reset_weekly() TO authenticated;
