DROP POLICY IF EXISTS "Owner writes entries" ON public.timesheet_entries;
CREATE POLICY "Owner or admin writes entries" ON public.timesheet_entries
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.timesheets t WHERE t.id = timesheet_entries.timesheet_id AND (t.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))));