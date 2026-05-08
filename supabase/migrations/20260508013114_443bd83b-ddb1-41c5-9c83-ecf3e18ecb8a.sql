
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS department public.department;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_scope_chk CHECK (scope IN ('personal','team'));

CREATE INDEX IF NOT EXISTS tasks_dept_scope_idx ON public.tasks(department, scope) WHERE scope = 'team';

-- Replace RLS policies
DROP POLICY IF EXISTS "Team reads tasks" ON public.tasks;
DROP POLICY IF EXISTS "Team creates tasks" ON public.tasks;
DROP POLICY IF EXISTS "Owner admin or assignee updates tasks" ON public.tasks;
DROP POLICY IF EXISTS "Owner or admin deletes tasks" ON public.tasks;

-- SELECT: any team member can read team-scope tasks; personal tasks visible to owner/assignee/admin
CREATE POLICY "Read tasks"
ON public.tasks FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (scope = 'personal' AND (owner_id = auth.uid() OR assigned_to = auth.uid()))
  OR (scope = 'team' AND department IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.department = tasks.department
  ))
);

-- INSERT: personal tasks must have owner_id = me (admins can target anyone); team tasks require user's department to match
CREATE POLICY "Create tasks"
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (
  public.is_team_member(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (scope = 'personal' AND owner_id = auth.uid())
    OR (scope = 'team' AND department IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.department = tasks.department
    ))
  )
);

-- UPDATE: admins always; personal tasks by owner/assignee; team tasks by any member of that department
CREATE POLICY "Update tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (scope = 'personal' AND (owner_id = auth.uid() OR assigned_to = auth.uid()))
  OR (scope = 'team' AND department IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.department = tasks.department
  ))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (scope = 'personal' AND (owner_id = auth.uid() OR assigned_to = auth.uid()))
  OR (scope = 'team' AND department IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.department = tasks.department
  ))
);

-- DELETE: admins; personal owner; team-dept members
CREATE POLICY "Delete tasks"
ON public.tasks FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (scope = 'personal' AND owner_id = auth.uid())
  OR (scope = 'team' AND department IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.department = tasks.department
  ))
);
