-- Tighten team_availability access: only team members or admins can read,
-- only the owner or an admin can insert/update, and updates can't reassign user_id.

-- Restrict SELECT to team members (admin/employee) explicitly
DROP POLICY IF EXISTS "Team reads availability" ON public.team_availability;
CREATE POLICY "Team reads availability"
  ON public.team_availability
  FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()));

-- INSERT: only as self, or admin acting on someone else
DROP POLICY IF EXISTS "Users insert own availability" ON public.team_availability;
CREATE POLICY "Owner or admin inserts availability"
  ON public.team_availability
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- UPDATE: owner or admin; check expression also prevents re-assigning user_id to someone else
DROP POLICY IF EXISTS "Users update own availability" ON public.team_availability;
CREATE POLICY "Owner or admin updates availability"
  ON public.team_availability
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- DELETE: admin-only (already exists, re-create for clarity scoped to authenticated)
DROP POLICY IF EXISTS "Admins delete availability" ON public.team_availability;
CREATE POLICY "Admins delete availability"
  ON public.team_availability
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));