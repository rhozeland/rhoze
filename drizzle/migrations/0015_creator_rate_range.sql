ALTER TABLE public.creator_directory ADD COLUMN IF NOT EXISTS hourly_rate_max_cents integer;
CREATE OR REPLACE FUNCTION public.creator_save_rate_max(p_id uuid, p_max_cents integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM creator_directory WHERE id = p_id AND (user_id = auth.uid() OR is_team_member(auth.uid()))) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_max_cents IS NOT NULL AND (p_max_cents < 0 OR p_max_cents > 10000000) THEN RAISE EXCEPTION 'Invalid rate'; END IF;
  UPDATE creator_directory SET hourly_rate_max_cents = p_max_cents WHERE id = p_id;
END $$;
GRANT EXECUTE ON FUNCTION public.creator_save_rate_max(uuid, integer) TO authenticated;