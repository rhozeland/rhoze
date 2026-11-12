DROP POLICY IF EXISTS "Anyone uploads application attachments" ON storage.objects;
CREATE POLICY "Anyone uploads application attachments" ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'applications'
  AND lower(name) ~ '\.(jpg|jpeg|png|webp|gif|heic|pdf|doc|docx|txt|rtf|key|pptx|mp3|wav|m4a|aac|flac|mp4|mov|webm|zip)$'
);