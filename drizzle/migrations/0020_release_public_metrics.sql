CREATE OR REPLACE FUNCTION public.release_public_metrics(p_slug text)
RETURNS TABLE(likes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::bigint
  FROM public.project_likes pl
  JOIN public.releases r ON r.id = pl.release_id
  WHERE r.slug = p_slug AND r.status = 'published';
$$;

REVOKE ALL ON FUNCTION public.release_public_metrics(text) FROM public;
GRANT EXECUTE ON FUNCTION public.release_public_metrics(text) TO anon, authenticated;