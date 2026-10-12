CREATE OR REPLACE FUNCTION public.creator_progress(p_user_id uuid DEFAULT auth.uid()) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT CASE WHEN p_user_id = auth.uid() OR EXISTS(SELECT 1 FROM public.creator_directory c WHERE c.user_id=p_user_id AND c.is_public AND c.approved) THEN (
SELECT jsonb_build_object('xp',coalesce(sum(CASE WHEN kind IN ('release_published','project_like','role_application','project_payment') THEN greatest(amount,0) ELSE 0 END),0),'contributions',count(*) FILTER(WHERE kind IN ('release_published','project_like','role_application','project_payment')), 'projects',count(*) FILTER(WHERE kind='release_published'),'likes',count(*) FILTER(WHERE kind='project_like'),'applications',count(*) FILTER(WHERE kind='role_application'),'payments',count(*) FILTER(WHERE kind='project_payment')) FROM public.user_rewards_ledger WHERE user_id=p_user_id
) ELSE NULL END;
$$;
REVOKE ALL ON FUNCTION public.creator_progress(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creator_progress(uuid) TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.creator_standings() RETURNS TABLE(slug text,display_name text,photo_url text,xp bigint,contributions bigint,rank_position bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH earned AS (SELECT user_id,sum(greatest(amount,0))::bigint AS xp,count(*)::bigint AS contributions FROM public.user_rewards_ledger WHERE kind IN ('release_published','project_like','role_application','project_payment') GROUP BY user_id), people AS (SELECT DISTINCT ON(c.user_id) c.slug,c.display_name,c.photo_url,e.xp,e.contributions FROM public.creator_directory c JOIN earned e ON e.user_id=c.user_id WHERE c.is_public AND c.approved AND e.xp>0 ORDER BY c.user_id,c.created_at)
SELECT slug,display_name,photo_url,xp,contributions,dense_rank() OVER(ORDER BY xp DESC) FROM people ORDER BY xp DESC,slug LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.creator_standings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creator_standings() TO anon,authenticated;