-- 1) Tighten profiles self-update to also protect payment_email and hourly_rate_cents
DROP POLICY IF EXISTS "Users update own profile (member fields)" ON public.profiles;

CREATE POLICY "Users update own profile (member fields)"
ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND NOT (department IS DISTINCT FROM (SELECT p.department FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (job_title IS DISTINCT FROM (SELECT p.job_title FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (employment_status IS DISTINCT FROM (SELECT p.employment_status FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (started_at IS DISTINCT FROM (SELECT p.started_at FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (ended_at IS DISTINCT FROM (SELECT p.ended_at FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (wage IS DISTINCT FROM (SELECT p.wage FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (payment_method IS DISTINCT FROM (SELECT p.payment_method FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (payment_email IS DISTINCT FROM (SELECT p.payment_email FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (hourly_rate_cents IS DISTINCT FROM (SELECT p.hourly_rate_cents FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (program IS DISTINCT FROM (SELECT p.program FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (internal_notes IS DISTINCT FROM (SELECT p.internal_notes FROM public.profiles p WHERE p.id = auth.uid()))
);

-- 2) Allow doc creators to delete their own storage object (mirrors "Creators can delete own docs" on public.docs)
CREATE POLICY "Creators delete own doc files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'docs'
  AND EXISTS (
    SELECT 1 FROM public.docs d
    WHERE d.file_path = storage.objects.name
      AND d.created_by = auth.uid()
  )
);