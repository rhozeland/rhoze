DROP POLICY "Visitors view approved creators" ON public.creator_directory;
CREATE POLICY "Visitors view approved creators" ON public.creator_directory FOR SELECT TO anon, authenticated USING (approved = true);
CREATE POLICY "Team views creator drafts" ON public.creator_directory FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));