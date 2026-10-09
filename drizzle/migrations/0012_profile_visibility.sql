ALTER TABLE public.creator_directory ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
DROP POLICY "Visitors view approved creators" ON public.creator_directory;
CREATE POLICY "Visitors view approved creators" ON public.creator_directory FOR SELECT TO anon, authenticated USING (approved = true AND (is_public = true OR user_id = auth.uid()));
CREATE OR REPLACE FUNCTION public.creator_set_visibility(p_id uuid, p_public boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.creator_directory SET is_public = p_public, updated_at = now()
  WHERE id = p_id AND (user_id = auth.uid() OR public.is_team_member(auth.uid()));
  IF NOT FOUND THEN RAISE EXCEPTION 'not allowed'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.creator_set_visibility(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.creator_set_visibility(uuid, boolean) TO authenticated;