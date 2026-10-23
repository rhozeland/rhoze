CREATE TABLE public.waitlist_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL UNIQUE,
 role text NOT NULL CHECK (role IN ('artist','brand','creative','fan')),
 project_line text NOT NULL DEFAULT '' CHECK (char_length(project_line) <= 500),
 share_code text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
 referrer_id uuid REFERENCES public.waitlist_entries(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (char_length(email) <= 254 AND email = lower(btrim(email)) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
GRANT SELECT ON public.waitlist_entries TO authenticated;
GRANT ALL ON public.waitlist_entries TO service_role;
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY waitlist_admin_read ON public.waitlist_entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX waitlist_referrer_idx ON public.waitlist_entries(referrer_id);
CREATE OR REPLACE FUNCTION public.waitlist_join(p_email text,p_role text,p_project_line text DEFAULT '',p_referrer text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text := lower(btrim(p_email)); v_ref uuid; v_code text;
BEGIN
 IF v_email IS NULL OR char_length(v_email)>254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
 IF p_role IS NULL OR p_role NOT IN ('artist','brand','creative','fan') THEN RAISE EXCEPTION 'invalid_role'; END IF;
 IF char_length(coalesce(p_project_line,''))>500 OR char_length(coalesce(p_referrer,''))>64 THEN RAISE EXCEPTION 'invalid_input'; END IF;
 SELECT id INTO v_ref FROM public.waitlist_entries WHERE share_code = p_referrer AND email <> v_email;
 INSERT INTO public.waitlist_entries(email,role,project_line,referrer_id) VALUES(v_email,p_role,btrim(coalesce(p_project_line,'')),v_ref) ON CONFLICT(email) DO NOTHING RETURNING share_code INTO v_code;
 IF v_code IS NULL THEN RETURN jsonb_build_object('status','duplicate'); END IF;
 RETURN jsonb_build_object('status','joined','share_code',v_code);
END $$;
REVOKE ALL ON FUNCTION public.waitlist_join(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.waitlist_join(text,text,text,text) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.waitlist_public_count() RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT CASE WHEN count(*) > 25 THEN count(*) ELSE NULL END FROM public.waitlist_entries $$;
REVOKE ALL ON FUNCTION public.waitlist_public_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.waitlist_public_count() TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.waitlist_admin_list() RETURNS TABLE(id uuid,email text,role text,project_line text,share_code text,referrer text,created_at timestamptz,referrals bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'not_authorized'; END IF;
 RETURN QUERY SELECT w.id,w.email,w.role,w.project_line,w.share_code,r.email,w.created_at,(SELECT count(*) FROM public.waitlist_entries child WHERE child.referrer_id=w.id) FROM public.waitlist_entries w LEFT JOIN public.waitlist_entries r ON r.id=w.referrer_id ORDER BY w.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.waitlist_admin_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.waitlist_admin_list() TO authenticated,service_role;