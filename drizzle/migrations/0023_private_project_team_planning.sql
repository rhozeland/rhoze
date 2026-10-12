CREATE TABLE public.release_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  creator_id uuid REFERENCES public.creator_directory(id) ON DELETE SET NULL,
  display_name text NOT NULL DEFAULT '',
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.release_team_members TO authenticated;
GRANT ALL ON public.release_team_members TO service_role;
ALTER TABLE public.release_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage project team planning" ON public.release_team_members FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.user_id = auth.uid()));
CREATE INDEX release_team_members_release_idx ON public.release_team_members(release_id);
CREATE OR REPLACE FUNCTION public.release_make_private(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  UPDATE public.releases SET status = 'draft', updated_at = now() WHERE id = p_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.release_make_private(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.release_make_private(uuid) TO authenticated;