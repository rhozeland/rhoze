CREATE TABLE public.project_bookmarks (
 user_id uuid NOT NULL,
 project_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id, project_key),
 CONSTRAINT bookmark_key_valid CHECK (project_key ~ '^/(project|release)/[a-z0-9-]+$')
);
GRANT SELECT, INSERT, DELETE ON public.project_bookmarks TO authenticated;
GRANT ALL ON public.project_bookmarks TO service_role;
ALTER TABLE public.project_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own bookmarks" ON public.project_bookmarks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Save own bookmarks" ON public.project_bookmarks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Remove own bookmarks" ON public.project_bookmarks FOR DELETE TO authenticated USING (user_id = auth.uid());
COMMENT ON TABLE public.project_bookmarks IS 'Private project URL bookmarks. Visibility is resolved against public source records when browsing; bookmarks award no rewards.';