
-- Add targeting + uploaded-file fields to docs
ALTER TABLE public.docs
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS department public.department NULL,
  ADD COLUMN IF NOT EXISTS target_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS file_path text NULL,
  ADD COLUMN IF NOT EXISTS file_name text NULL,
  ADD COLUMN IF NOT EXISTS file_mime text NULL,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint NULL,
  ADD COLUMN IF NOT EXISTS thumbnail_url text NULL;

ALTER TABLE public.docs
  DROP CONSTRAINT IF EXISTS docs_audience_check;
ALTER TABLE public.docs
  ADD CONSTRAINT docs_audience_check CHECK (audience IN ('all','department','user'));

-- Recreate read policy with audience targeting
DROP POLICY IF EXISTS "Team reads docs" ON public.docs;
CREATE POLICY "Team reads docs"
  ON public.docs
  FOR SELECT
  USING (
    is_team_member(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR audience = 'all'
      OR (audience = 'department' AND department IS NOT NULL
          AND department = (SELECT p.department FROM public.profiles p WHERE p.id = auth.uid()))
      OR (audience = 'user' AND target_user_id = auth.uid())
    )
  );

-- Private storage bucket for uploaded doc attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('docs', 'docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Team reads doc files" ON storage.objects;
CREATE POLICY "Team reads doc files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'docs' AND is_team_member(auth.uid()));

DROP POLICY IF EXISTS "Admins write doc files" ON storage.objects;
CREATE POLICY "Admins write doc files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'docs' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update doc files" ON storage.objects;
CREATE POLICY "Admins update doc files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'docs' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete doc files" ON storage.objects;
CREATE POLICY "Admins delete doc files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'docs' AND has_role(auth.uid(), 'admin'::app_role));
