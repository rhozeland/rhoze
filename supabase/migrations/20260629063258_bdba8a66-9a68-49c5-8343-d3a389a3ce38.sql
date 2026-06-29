
GRANT SELECT ON public.community_leaderboard TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.community_leaderboard TO authenticated;
GRANT ALL ON public.community_leaderboard TO service_role;

GRANT SELECT ON public.community_submissions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.community_submissions TO authenticated;
GRANT ALL ON public.community_submissions TO service_role;

GRANT SELECT ON public.community_points_rules TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.community_points_rules TO authenticated;
GRANT ALL ON public.community_points_rules TO service_role;

GRANT SELECT ON public.community_challenges TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.community_challenges TO authenticated;
GRANT ALL ON public.community_challenges TO service_role;
