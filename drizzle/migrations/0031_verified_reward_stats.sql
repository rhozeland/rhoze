CREATE OR REPLACE FUNCTION public.my_contribution_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE jsonb_build_object(
'all_time',coalesce(sum(greatest(amount,0)),0),
'weekly',coalesce(sum(greatest(amount,0)) FILTER (WHERE created_at >= (date_trunc('week',now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto')),0),
'contributions',count(*),
'weekly_contributions',count(*) FILTER (WHERE created_at >= (date_trunc('week',now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto')))
END FROM public.user_rewards_ledger WHERE user_id=auth.uid() AND kind IN ('release_published','project_like','role_application','project_payment');
$$;
REVOKE ALL ON FUNCTION public.my_contribution_stats() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_contribution_stats() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.project_reward_stats(p_release_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT CASE WHEN EXISTS(SELECT 1 FROM public.releases WHERE id=p_release_id AND status='published') THEN
jsonb_build_object('points',coalesce(sum(greatest(e.amount,0)),0),'my_points',coalesce(sum(greatest(e.amount,0)) FILTER (WHERE e.user_id=auth.uid()),0),'like_reward',public.rz_reward_amount('project_like')) ELSE NULL END
FROM public.user_rewards_ledger e WHERE
(e.kind IN ('release_published','project_like') AND e.ref_id=p_release_id)
OR (e.kind='role_application' AND EXISTS(SELECT 1 FROM public.release_applications a WHERE a.id=e.ref_id AND a.release_id=p_release_id));
$$;
REVOKE ALL ON FUNCTION public.project_reward_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_reward_stats(uuid) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.rz_award_project_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.releases WHERE id=new.release_id AND status='published') THEN
 INSERT INTO public.user_rewards_ledger(user_id,kind,amount,ref_id,reason)
 VALUES(new.user_id,'project_like',public.rz_reward_amount('project_like'),new.release_id,'Liked a project')
 ON CONFLICT(user_id,kind,ref_id) DO NOTHING;
 END IF;
 RETURN new;
END;
$$;