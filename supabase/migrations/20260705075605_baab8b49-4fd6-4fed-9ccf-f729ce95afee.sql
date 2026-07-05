DROP POLICY IF EXISTS "Published live content is public" ON public.live_dashboard_content;

CREATE POLICY "Published live content is public"
ON public.live_dashboard_content
FOR SELECT
TO anon, authenticated
USING (is_published = true);

CREATE POLICY "Team can view draft live content"
ON public.live_dashboard_content
FOR SELECT
TO authenticated
USING (public.is_team_member(auth.uid()));