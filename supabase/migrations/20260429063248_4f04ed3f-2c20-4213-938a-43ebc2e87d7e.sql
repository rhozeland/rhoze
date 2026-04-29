REVOKE ALL ON FUNCTION public.apply_tier_credits(uuid, text)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.archive_expired_projects()              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_pending_tier_change(uuid)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_project_from_intake(uuid)        FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.apply_tier_credits(uuid, text)         TO service_role;
GRANT  EXECUTE ON FUNCTION public.archive_expired_projects()              TO service_role;
GRANT  EXECUTE ON FUNCTION public.apply_pending_tier_change(uuid)         TO service_role;
GRANT  EXECUTE ON FUNCTION public.create_project_from_intake(uuid)        TO service_role;