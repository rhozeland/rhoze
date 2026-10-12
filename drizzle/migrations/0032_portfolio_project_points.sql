CREATE TABLE public.portfolio_project_likes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 slug text NOT NULL REFERENCES public.portfolio_details(slug),
 liked boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,slug)
);
GRANT SELECT,INSERT,UPDATE ON public.portfolio_project_likes TO authenticated;
GRANT ALL ON public.portfolio_project_likes TO service_role;
ALTER TABLE public.portfolio_project_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own portfolio likes" ON public.portfolio_project_likes FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY "Insert own portfolio likes" ON public.portfolio_project_likes FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND liked=true);
CREATE POLICY "Update own portfolio likes" ON public.portfolio_project_likes FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.portfolio_like_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF new.id IS DISTINCT FROM old.id OR new.user_id IS DISTINCT FROM old.user_id OR new.slug IS DISTINCT FROM old.slug OR new.created_at IS DISTINCT FROM old.created_at THEN RAISE EXCEPTION 'Like identity cannot change'; END IF; RETURN new; END; $$;
CREATE TRIGGER portfolio_like_identity BEFORE UPDATE ON public.portfolio_project_likes FOR EACH ROW EXECUTE FUNCTION public.portfolio_like_immutable();
CREATE OR REPLACE FUNCTION public.rz_award_portfolio_like() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.user_rewards_ledger(user_id,kind,amount,ref_id,reason) VALUES(new.user_id,'project_like',public.rz_reward_amount('project_like'),new.id,'Liked a portfolio project') ON CONFLICT(user_id,kind,ref_id) DO NOTHING; RETURN new; END; $$;
CREATE TRIGGER portfolio_like_reward AFTER INSERT ON public.portfolio_project_likes FOR EACH ROW EXECUTE FUNCTION public.rz_award_portfolio_like();
CREATE OR REPLACE FUNCTION public.portfolio_reward_stats(p_slug text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT CASE WHEN EXISTS(SELECT 1 FROM public.portfolio_details WHERE slug=p_slug) THEN jsonb_build_object('points',coalesce(sum(greatest(e.amount,0)),0),'my_points',coalesce(sum(greatest(e.amount,0)) FILTER(WHERE e.user_id=auth.uid()),0),'like_reward',public.rz_reward_amount('project_like')) ELSE NULL END FROM public.user_rewards_ledger e JOIN public.portfolio_project_likes l ON l.id=e.ref_id WHERE l.slug=p_slug AND e.kind='project_like'; $$;
REVOKE ALL ON FUNCTION public.portfolio_reward_stats(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portfolio_reward_stats(text) TO anon,authenticated,service_role;