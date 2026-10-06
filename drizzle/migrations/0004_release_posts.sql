CREATE TABLE public.release_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  media_path text,
  media_kind text CHECK (media_kind IN ('image','video')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX release_posts_release_idx ON public.release_posts(release_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.release_posts TO authenticated;
GRANT ALL ON public.release_posts TO service_role;
ALTER TABLE public.release_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads posts" ON public.release_posts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.user_id = auth.uid()));
CREATE POLICY "Owner adds posts" ON public.release_posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.user_id = auth.uid()));
CREATE POLICY "Owner deletes posts" ON public.release_posts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.user_id = auth.uid()));
CREATE POLICY "Release owner uploads post media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'release-posts' AND EXISTS (SELECT 1 FROM public.releases r WHERE r.id::text = (storage.foldername(name))[1] AND r.user_id = auth.uid()));
CREATE POLICY "Release owner reads post media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'release-posts' AND EXISTS (SELECT 1 FROM public.releases r WHERE r.id::text = (storage.foldername(name))[1] AND r.user_id = auth.uid()));