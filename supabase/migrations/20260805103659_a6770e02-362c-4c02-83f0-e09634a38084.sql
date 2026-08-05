CREATE OR REPLACE FUNCTION public.community_avatar_list()
RETURNS TABLE (handle_key text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(regexp_replace(COALESCE(p.community_username, ''), '^@', '')) AS handle_key,
         p.avatar_url
  FROM public.profiles p
  WHERE p.community_username IS NOT NULL
    AND p.avatar_url IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.community_avatar_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_avatar_list() TO anon, authenticated;