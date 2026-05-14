-- Update the SELECT RLS policy on docs to let admins and HR employees
-- view docs with audience = 'admin'
ALTER POLICY "Team reads docs" ON public.docs
USING (
  is_team_member(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (audience = 'all'::text)
    OR (
      (audience = 'department'::text)
      AND (department IS NOT NULL)
      AND (department = (
        SELECT p.department FROM profiles p WHERE (p.id = auth.uid())
      ))
    )
    OR (
      (audience = 'user'::text)
      AND (target_user_id = auth.uid())
    )
    OR (
      (audience = 'admin'::text)
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR (
          SELECT p.department FROM profiles p WHERE (p.id = auth.uid())
        ) = 'hr'
      )
    )
  )
);