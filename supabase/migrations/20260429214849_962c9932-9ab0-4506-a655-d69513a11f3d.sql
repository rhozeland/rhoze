-- Add operations to department enum
ALTER TYPE public.department ADD VALUE IF NOT EXISTS 'operations';

-- Add employment tracking fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employment_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS started_at date,
  ADD COLUMN IF NOT EXISTS ended_at date,
  ADD COLUMN IF NOT EXISTS employment_notes text;

-- Update the member-fields update policy to also lock employment fields from self-edit
DROP POLICY IF EXISTS "Users update own profile (member fields)" ON public.profiles;
CREATE POLICY "Users update own profile (member fields)"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND department IS NOT DISTINCT FROM (SELECT p.department FROM public.profiles p WHERE p.id = auth.uid())
  AND job_title IS NOT DISTINCT FROM (SELECT p.job_title FROM public.profiles p WHERE p.id = auth.uid())
  AND employment_status IS NOT DISTINCT FROM (SELECT p.employment_status FROM public.profiles p WHERE p.id = auth.uid())
  AND started_at IS NOT DISTINCT FROM (SELECT p.started_at FROM public.profiles p WHERE p.id = auth.uid())
  AND ended_at IS NOT DISTINCT FROM (SELECT p.ended_at FROM public.profiles p WHERE p.id = auth.uid())
);