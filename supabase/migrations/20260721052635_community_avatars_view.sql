-- Public view exposing ONLY handle -> avatar_url pairs for leaderboard rendering.
-- No emails, no ids, no PII. Runs as view owner (security_definer semantics for
-- views) so we do NOT need to open profiles RLS to anon.
CREATE OR REPLACE VIEW public.community_avatars AS
SELECT
  lower(regexp_replace(coalesce(community_username, ''), '^@', '')) AS handle_key,
  avatar_url
FROM public.profiles
WHERE community_username IS NOT NULL
  AND avatar_url IS NOT NULL;

REVOKE ALL ON public.community_avatars FROM PUBLIC;
GRANT SELECT ON public.community_avatars TO anon, authenticated;
