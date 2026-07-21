CREATE OR REPLACE VIEW public.community_avatars
WITH (security_invoker = off) AS
SELECT
  lower(regexp_replace(coalesce(community_username, ''), '^@', '')) AS handle_key,
  avatar_url
FROM public.profiles
WHERE community_username IS NOT NULL
  AND avatar_url IS NOT NULL;

REVOKE ALL ON public.community_avatars FROM PUBLIC;
GRANT SELECT ON public.community_avatars TO anon, authenticated;