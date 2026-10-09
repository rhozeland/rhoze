CREATE OR REPLACE FUNCTION public.creator_save_details(p_id uuid, p_name text, p_disciplines text[], p_rate_cents integer, p_photo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM creator_directory WHERE id = p_id AND (user_id = auth.uid() OR is_team_member(auth.uid()))) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF length(trim(coalesce(p_name,''))) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;
  IF p_rate_cents IS NOT NULL AND (p_rate_cents < 0 OR p_rate_cents > 10000000) THEN RAISE EXCEPTION 'Invalid rate'; END IF;
  IF coalesce(array_length(p_disciplines,1),0) > 8 THEN RAISE EXCEPTION 'Too many tags'; END IF;
  UPDATE creator_directory SET display_name = left(trim(p_name),100),
    disciplines = (SELECT coalesce(array_agg(left(trim(d),40)),'{}') FROM unnest(coalesce(p_disciplines,'{}')) d WHERE trim(d) <> ''),
    hourly_rate_cents = p_rate_cents, photo_url = left(nullif(trim(p_photo),''),500), updated_at = now()
  WHERE id = p_id;
END $$;
REVOKE ALL ON FUNCTION public.creator_save_details(uuid,text,text[],integer,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.creator_save_details(uuid,text,text[],integer,text) TO authenticated;