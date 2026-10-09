ALTER TABLE public.release_applications ADD COLUMN applicant_user_id uuid DEFAULT auth.uid();
CREATE INDEX release_applications_applicant_idx ON public.release_applications(applicant_user_id);
COMMENT ON COLUMN public.release_applications.applicant_user_id IS 'Authenticated submission identity; legacy anonymous applications remain unclaimed and must not be matched by name.';
CREATE OR REPLACE FUNCTION public.my_application_inbox()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object(
 'id',a.id,'release_id',a.release_id,'role_name',a.role_name,'role_index',a.role_index,
 'name',a.name,'link',a.link,'description',a.availability,'files',a.files,
 'status',a.status,'created_at',a.created_at,'updated_at',a.updated_at,
 'project_title',r.title,'project_slug',r.slug,'brand_name',r.creator_name,
 'is_owner',r.user_id=auth.uid(),'applicant_user_id',a.applicant_user_id,
 'profile_slug',CASE WHEN c.is_public OR c.user_id=auth.uid() THEN c.slug END,
 'photo_url',CASE WHEN c.is_public OR c.user_id=auth.uid() THEN c.photo_url END,
 'skills',CASE WHEN c.is_public OR c.user_id=auth.uid() THEN c.disciplines ELSE '{}'::text[] END
 ) ORDER BY a.created_at DESC),'[]'::jsonb)
 FROM public.release_applications a JOIN public.releases r ON r.id=a.release_id
 LEFT JOIN LATERAL (SELECT d.* FROM public.creator_directory d WHERE d.user_id=a.applicant_user_id ORDER BY d.created_at LIMIT 1) c ON true
 WHERE auth.uid() IS NOT NULL AND (a.applicant_user_id=auth.uid() OR r.user_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.my_application_inbox() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_application_inbox() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.application_start_conversation(p_application_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.release_applications; r public.releases; t uuid;
BEGIN
 SELECT * INTO a FROM public.release_applications WHERE id=p_application_id;
 SELECT * INTO r FROM public.releases WHERE id=a.release_id;
 IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM r.user_id AND auth.uid() IS DISTINCT FROM a.applicant_user_id) THEN RAISE EXCEPTION 'application not found'; END IF;
 IF a.applicant_user_id IS NULL THEN RAISE EXCEPTION 'This applicant submitted without an account. Use their portfolio contact details.'; END IF;
 IF r.user_id IS NULL OR r.user_id=a.applicant_user_id THEN RAISE EXCEPTION 'Conversation unavailable'; END IF;
 INSERT INTO public.dm_threads(starter_id,owner_id,profile_kind,profile_slug,profile_name)
 VALUES(a.applicant_user_id,r.user_id,'brand',public.rz_slugify(r.creator_name),r.creator_name)
 ON CONFLICT(starter_id,profile_kind,profile_slug) DO UPDATE SET owner_id=coalesce(dm_threads.owner_id,excluded.owner_id)
 RETURNING id INTO t;
 RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.application_start_conversation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.application_start_conversation(uuid) TO authenticated,service_role;