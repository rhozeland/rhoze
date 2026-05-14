
DROP POLICY IF EXISTS "Team reads doc files" ON storage.objects;

CREATE POLICY "Audience reads doc files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'docs'
    AND is_team_member(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.docs d
      WHERE d.file_path = storage.objects.name
        AND (
          has_role(auth.uid(), 'admin'::app_role)
          OR d.audience = 'all'
          OR (d.audience = 'department' AND d.department IS NOT NULL
              AND d.department = (SELECT p.department FROM public.profiles p WHERE p.id = auth.uid()))
          OR (d.audience = 'user' AND d.target_user_id = auth.uid())
        )
    )
  );
