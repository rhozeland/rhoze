ALTER TABLE public.creator_directory ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.creator_directory ADD COLUMN IF NOT EXISTS country text;

CREATE OR REPLACE FUNCTION public.creator_save_location(p_id uuid, p_city text, p_country text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM creator_directory WHERE id = p_id AND (user_id = auth.uid() OR is_team_member(auth.uid()))) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE creator_directory SET
    city = left(nullif(trim(p_city),''),100),
    country = left(nullif(trim(p_country),''),2),
    updated_at = now()
  WHERE id = p_id;
END $$;
REVOKE ALL ON FUNCTION public.creator_save_location(uuid,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.creator_save_location(uuid,text,text) TO authenticated;
