CREATE TABLE public.project_like_preferences (
 user_id uuid PRIMARY KEY,
 is_public boolean NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE ON public.project_like_preferences TO authenticated;
GRANT SELECT ON public.project_like_preferences TO anon;
GRANT ALL ON public.project_like_preferences TO service_role;
ALTER TABLE public.project_like_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read liked list visibility" ON public.project_like_preferences FOR SELECT TO anon, authenticated USING (is_public OR user_id = auth.uid());
CREATE POLICY "Create own liked list visibility" ON public.project_like_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own liked list visibility" ON public.project_like_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TABLE public.project_likes (
 user_id uuid NOT NULL,
 release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id, release_id)
);
GRANT SELECT ON public.project_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.project_likes TO authenticated;
GRANT ALL ON public.project_likes TO service_role;
ALTER TABLE public.project_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or public liked projects" ON public.project_likes FOR SELECT TO anon, authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.project_like_preferences p WHERE p.user_id = project_likes.user_id AND p.is_public));
CREATE POLICY "Like published projects" ON public.project_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.status = 'published'));
CREATE POLICY "Unlike own projects" ON public.project_likes FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX project_likes_recent_idx ON public.project_likes (user_id, created_at DESC);