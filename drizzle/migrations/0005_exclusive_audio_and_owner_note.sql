ALTER TABLE public.release_posts DROP CONSTRAINT release_posts_media_kind_check;
ALTER TABLE public.release_posts ADD CONSTRAINT release_posts_media_kind_check CHECK (media_kind = ANY (ARRAY['image','video','audio']));
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS owner_note text CHECK (owner_note IS NULL OR char_length(owner_note) <= 280);
GRANT SELECT (owner_note) ON public.releases TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.release_set_note(p_id uuid, p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not allowed'; END IF;
  UPDATE public.releases SET owner_note = NULLIF(btrim(left(coalesce(p_note,''),280)),'')
   WHERE id = p_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not allowed'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.release_set_note(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.release_set_note(uuid,text) TO authenticated;