-- Public view exposing community usernames -> avatar_url for the leaderboard.
-- Only rows that opted into the leaderboard (have community_username set) and
-- have a Toy Box / avatar image are exposed. No emails, no PII.
CREATE OR REPLACE VIEW public.community_avatars
WITH (security_invoker = true) AS
SELECT
  lower(regexp_replace(coalesce(community_username, ''), '^@', '')) AS handle_key,
  avatar_url
FROM public.profiles
WHERE community_username IS NOT NULL
  AND avatar_url IS NOT NULL;

-- security_invoker means the view respects the querying role's RLS on profiles.
-- Add an explicit policy so anon/authenticated can read the minimal columns
-- needed to render leaderboard avatars.
DROP POLICY IF EXISTS "Public leaderboard avatars readable" ON public.profiles;
CREATE POLICY "Public leaderboard avatars readable"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (community_username IS NOT NULL AND avatar_url IS NOT NULL);

GRANT SELECT ON public.community_avatars TO anon, authenticated;
