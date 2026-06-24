-- Restrict stripe_price_id column on service_packages to admin/service_role
REVOKE SELECT (stripe_price_id) ON public.service_packages FROM anon, authenticated;

-- Avatars bucket: restrict object listing to file owner or admins
CREATE POLICY "Users list own avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);