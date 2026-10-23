CREATE OR REPLACE FUNCTION public.rz_owns_release(_rid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.releases WHERE id=_rid AND user_id=auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.rz_owns_release_path(_name text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN RETURN public.rz_owns_release(split_part(_name,'/',1)::uuid); EXCEPTION WHEN others THEN RETURN false; END $$;
CREATE TABLE public.release_board_items(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('note','image','audio','colour','link')),
  x integer NOT NULL DEFAULT 40, y integer NOT NULL DEFAULT 40,
  color text, body text CHECK (char_length(body)<=2000), url text CHECK (char_length(url)<=2000), storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.release_board_items TO authenticated;
GRANT ALL ON public.release_board_items TO service_role;
ALTER TABLE public.release_board_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage board" ON public.release_board_items FOR ALL TO authenticated
  USING (public.rz_owns_release(release_id)) WITH CHECK (public.rz_owns_release(release_id));
CREATE POLICY "Owners read board media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='board-media' AND public.rz_owns_release_path(name));
CREATE POLICY "Owners add board media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='board-media' AND public.rz_owns_release_path(name));
CREATE POLICY "Owners delete board media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='board-media' AND public.rz_owns_release_path(name));