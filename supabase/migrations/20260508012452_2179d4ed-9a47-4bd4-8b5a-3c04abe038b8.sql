
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS assigned_by uuid,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;

CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON public.tasks(assigned_to) WHERE assigned_to IS NOT NULL;

-- Drop and recreate policies
DROP POLICY IF EXISTS "Team creates own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Owner or admin updates tasks" ON public.tasks;
DROP POLICY IF EXISTS "Owner or admin deletes tasks" ON public.tasks;

-- SELECT: team members can read all team tasks (existing pattern). Add explicit policy.
DROP POLICY IF EXISTS "Team reads tasks" ON public.tasks;
CREATE POLICY "Team reads tasks"
ON public.tasks FOR SELECT TO authenticated
USING (public.is_team_member(auth.uid()));

-- INSERT: team members create their own tasks; admins can create tasks assigned to anyone
CREATE POLICY "Team creates tasks"
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (
  public.is_team_member(auth.uid()) AND (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- UPDATE: owner, admin, or assignee (assignee can mark done / acknowledge)
CREATE POLICY "Owner admin or assignee updates tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (
  owner_id = auth.uid()
  OR assigned_to = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  owner_id = auth.uid()
  OR assigned_to = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- DELETE: owner or admin
CREATE POLICY "Owner or admin deletes tasks"
ON public.tasks FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
