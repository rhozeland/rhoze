
-- Extend milestone_messages with optional attachment + embed fields
ALTER TABLE public.milestone_messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_mime text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint,
  ADD COLUMN IF NOT EXISTS embed_url text;

-- Allow body to be empty when there is an attachment or embed
ALTER TABLE public.milestone_messages ALTER COLUMN body DROP NOT NULL;
ALTER TABLE public.milestone_messages
  ADD CONSTRAINT milestone_messages_has_content_chk
  CHECK (
    (body IS NOT NULL AND length(btrim(body)) > 0)
    OR attachment_path IS NOT NULL
    OR embed_url IS NOT NULL
  );

-- Storage policies for the milestone-attachments bucket.
-- Path layout: {project_id}/{milestone_id}/{uuid}-{filename}
CREATE POLICY "Milestone attachments: project members read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'milestone-attachments'
  AND (
    public.is_team_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_clients pc
      WHERE pc.user_id = auth.uid()
        AND pc.project_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "Milestone attachments: project members upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'milestone-attachments'
  AND (
    public.is_team_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_clients pc
      WHERE pc.user_id = auth.uid()
        AND pc.project_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "Milestone attachments: owner or admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'milestone-attachments'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);
