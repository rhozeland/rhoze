
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS wage text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS work_type text,
  ADD COLUMN IF NOT EXISTS stage_name text,
  ADD COLUMN IF NOT EXISTS program text,
  ADD COLUMN IF NOT EXISTS internal_notes text;

-- Allow users to update their own personal mastersheet fields (phone/address/dob/emergency/stage_name)
-- by relaxing the existing self-update lock-down. Drop and recreate.
DROP POLICY IF EXISTS "Users update own profile (member fields)" ON public.profiles;
CREATE POLICY "Users update own profile (member fields)"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND NOT (department IS DISTINCT FROM (SELECT p.department FROM profiles p WHERE p.id = auth.uid()))
  AND NOT (job_title IS DISTINCT FROM (SELECT p.job_title FROM profiles p WHERE p.id = auth.uid()))
  AND NOT (employment_status IS DISTINCT FROM (SELECT p.employment_status FROM profiles p WHERE p.id = auth.uid()))
  AND NOT (started_at IS DISTINCT FROM (SELECT p.started_at FROM profiles p WHERE p.id = auth.uid()))
  AND NOT (ended_at IS DISTINCT FROM (SELECT p.ended_at FROM profiles p WHERE p.id = auth.uid()))
  AND NOT (wage IS DISTINCT FROM (SELECT p.wage FROM profiles p WHERE p.id = auth.uid()))
  AND NOT (payment_method IS DISTINCT FROM (SELECT p.payment_method FROM profiles p WHERE p.id = auth.uid()))
  AND NOT (program IS DISTINCT FROM (SELECT p.program FROM profiles p WHERE p.id = auth.uid()))
  AND NOT (internal_notes IS DISTINCT FROM (SELECT p.internal_notes FROM profiles p WHERE p.id = auth.uid()))
);

-- Availability table
CREATE TABLE IF NOT EXISTS public.team_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  days text[] NOT NULL DEFAULT '{}',
  time_blocks text[] NOT NULL DEFAULT '{}',
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team reads availability"
ON public.team_availability FOR SELECT TO authenticated
USING (public.is_team_member(auth.uid()));

CREATE POLICY "Users insert own availability"
ON public.team_availability FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update own availability"
ON public.team_availability FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete availability"
ON public.team_availability FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER team_availability_updated_at
BEFORE UPDATE ON public.team_availability
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
