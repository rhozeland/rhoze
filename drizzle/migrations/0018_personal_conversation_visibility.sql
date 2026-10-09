ALTER TABLE public.dm_threads ADD COLUMN personal_started boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.dm_threads.personal_started IS 'True once a participant explicitly starts a personal conversation; application-only threads stay out of Messages.';
UPDATE public.dm_threads t SET personal_started=true WHERE NOT EXISTS (SELECT 1 FROM public.dm_messages m WHERE m.thread_id=t.id) OR EXISTS (SELECT 1 FROM public.dm_messages m WHERE m.thread_id=t.id AND m.body !~ '^Application: [^\n]+\nName: ');
CREATE OR REPLACE FUNCTION public.dm_open(p_kind text, p_slug text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _owner uuid; _name text; _id uuid;
BEGIN
 IF _uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
 IF p_kind='creator' THEN
 SELECT user_id,display_name INTO _owner,_name FROM creator_directory WHERE slug=p_slug;
 IF _name IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;
 ELSIF p_kind='brand' THEN
 SELECT user_id,name INTO _owner,_name FROM brand_profiles WHERE slug=p_slug;
 IF _owner IS NULL THEN SELECT user_id,coalesce(_name,creator_name) INTO _owner,_name FROM releases WHERE status='published' AND user_id IS NOT NULL AND rz_slugify(creator_name)=p_slug ORDER BY published_at LIMIT 1; END IF;
 IF _name IS NULL THEN SELECT creator_name INTO _name FROM releases WHERE status='published' AND rz_slugify(creator_name)=p_slug LIMIT 1; END IF;
 IF _name IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;
 ELSE RAISE EXCEPTION 'bad kind'; END IF;
 IF _owner=_uid THEN RAISE EXCEPTION 'this is your own profile'; END IF;
 INSERT INTO dm_threads(starter_id,owner_id,profile_kind,profile_slug,profile_name,personal_started) VALUES(_uid,_owner,p_kind,p_slug,_name,true)
 ON CONFLICT(starter_id,profile_kind,profile_slug) DO UPDATE SET owner_id=coalesce(dm_threads.owner_id,excluded.owner_id),personal_started=true RETURNING id INTO _id;
 RETURN _id;
END $$;
CREATE OR REPLACE FUNCTION public.application_start_conversation(p_application_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.release_applications; r public.releases; t uuid;
BEGIN
 SELECT * INTO a FROM release_applications WHERE id=p_application_id;
 SELECT * INTO r FROM releases WHERE id=a.release_id;
 IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM r.user_id AND auth.uid() IS DISTINCT FROM a.applicant_user_id) THEN RAISE EXCEPTION 'application not found'; END IF;
 IF a.applicant_user_id IS NULL THEN RAISE EXCEPTION 'This applicant submitted without an account. Use their portfolio contact details.'; END IF;
 IF r.user_id IS NULL OR r.user_id=a.applicant_user_id THEN RAISE EXCEPTION 'Conversation unavailable'; END IF;
 INSERT INTO dm_threads(starter_id,owner_id,profile_kind,profile_slug,profile_name,personal_started) VALUES(a.applicant_user_id,r.user_id,'brand',public.rz_slugify(r.creator_name),r.creator_name,true)
 ON CONFLICT(starter_id,profile_kind,profile_slug) DO UPDATE SET owner_id=coalesce(dm_threads.owner_id,excluded.owner_id),personal_started=true RETURNING id INTO t;
 RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.application_start_conversation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.application_start_conversation(uuid) TO authenticated,service_role;