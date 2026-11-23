CREATE TABLE public.featured_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  category text NOT NULL CHECK (category IN ('artist','brand','creator')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 1000),
  instagram text NOT NULL CHECK (char_length(instagram) BETWEEN 1 AND 200),
  website text CHECK (website IS NULL OR char_length(website) <= 300),
  main_link text NOT NULL CHECK (char_length(main_link) BETWEEN 1 AND 500),
  extra_links text[] NOT NULL DEFAULT '{}' CHECK (cardinality(extra_links) <= 5),
  pitch text NOT NULL CHECK (char_length(pitch) BETWEEN 1 AND 1500),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  primary_image text NOT NULL,
  images text[] NOT NULL DEFAULT '{}' CHECK (cardinality(images) <= 5),
  video_link text CHECK (video_link IS NULL OR char_length(video_link) <= 500),
  consent_ownership boolean NOT NULL CHECK (consent_ownership),
  consent_promotion boolean NOT NULL CHECK (consent_promotion),
  consent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','more_info','approved','in_production','scheduled','published','declined')),
  info_request text,
  applicant_reply text CHECK (applicant_reply IS NULL OR char_length(applicant_reply) <= 2000),
  decision_message text,
  scheduled_for timestamptz,
  published_at timestamptz,
  instagram_url text,
  facebook_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX featured_applications_user_idx ON public.featured_applications(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.featured_applications TO authenticated;
GRANT ALL ON public.featured_applications TO service_role;
ALTER TABLE public.featured_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Applicants read own featured applications" ON public.featured_applications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Applicants submit own featured applications" ON public.featured_applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins update featured applications" ON public.featured_applications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.featured_application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.featured_applications(id) ON DELETE CASCADE,
  status text NOT NULL,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.featured_application_events TO authenticated;
GRANT ALL ON public.featured_application_events TO service_role;
ALTER TABLE public.featured_application_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read history of visible applications" ON public.featured_application_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.featured_applications a WHERE a.id = application_id AND (a.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TABLE public.featured_application_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.featured_applications(id) ON DELETE CASCADE,
  author uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.featured_application_notes TO authenticated;
GRANT ALL ON public.featured_application_notes TO service_role;
ALTER TABLE public.featured_application_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage featured notes" ON public.featured_application_notes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin') AND author = auth.uid());

CREATE OR REPLACE FUNCTION public._featured_application_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'submitted'; NEW.info_request := NULL; NEW.applicant_reply := NULL; NEW.decision_message := NULL;
    NEW.scheduled_for := NULL; NEW.published_at := NULL; NEW.instagram_url := NULL; NEW.facebook_url := NULL;
    NEW.consent_at := now(); NEW.created_at := now();
    IF NEW.primary_image NOT LIKE NEW.user_id::text || '/%' OR EXISTS (SELECT 1 FROM unnest(NEW.images) p WHERE p NOT LIKE NEW.user_id::text || '/%') THEN
      RAISE EXCEPTION 'Images must be your own uploads';
    END IF;
  ELSE
    NEW.user_id := OLD.user_id; NEW.created_at := OLD.created_at; NEW.consent_at := OLD.consent_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER featured_application_guard BEFORE INSERT OR UPDATE ON public.featured_applications FOR EACH ROW EXECUTE FUNCTION public._featured_application_guard();

CREATE OR REPLACE FUNCTION public._featured_application_log() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.featured_application_events(application_id, status, actor) VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER featured_application_log AFTER INSERT OR UPDATE ON public.featured_applications FOR EACH ROW EXECUTE FUNCTION public._featured_application_log();
REVOKE EXECUTE ON FUNCTION public._featured_application_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._featured_application_log() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.featured_reply(p_id uuid, p_reply text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF p_reply IS NULL OR char_length(btrim(p_reply)) = 0 OR char_length(p_reply) > 2000 THEN RAISE EXCEPTION 'Reply must be 1-2000 characters'; END IF;
  UPDATE public.featured_applications SET applicant_reply = btrim(p_reply), status = 'under_review'
   WHERE id = p_id AND user_id = auth.uid() AND status = 'more_info';
  IF NOT FOUND THEN RAISE EXCEPTION 'Nothing to reply to'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.featured_reply(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.featured_reply(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.featured_published() RETURNS TABLE(name text, category text, instagram_url text, facebook_url text, published_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT name, category, instagram_url, facebook_url, published_at FROM public.featured_applications
  WHERE status = 'published' AND (instagram_url IS NOT NULL OR facebook_url IS NOT NULL)
  ORDER BY published_at DESC NULLS LAST LIMIT 12
$$;
GRANT EXECUTE ON FUNCTION public.featured_published() TO anon, authenticated;

CREATE POLICY "Members upload own featured media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'featured-submissions' AND owner_id = (select auth.uid()::text) AND (storage.foldername(name))[1] = (select auth.uid()::text) AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp'));
CREATE POLICY "Members and admins read featured media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'featured-submissions' AND ((storage.foldername(name))[1] = (select auth.uid()::text) OR public.has_role(auth.uid(),'admin')));