CREATE TABLE public.release_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  role_index integer NOT NULL,
  role_name text NOT NULL,
  name text NOT NULL,
  link text NOT NULL,
  availability text NOT NULL,
  status text NOT NULL DEFAULT 'applied',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.release_applications TO service_role;
ALTER TABLE public.release_applications ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.release_applications(release_id);
CREATE TRIGGER release_applications_updated BEFORE UPDATE ON public.release_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.release_apply(p_slug text, p_role_index int, p_name text, p_link text, p_availability text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r releases; v_role jsonb; v_id uuid;
BEGIN
  SELECT * INTO r FROM releases WHERE slug = p_slug AND status = 'published';
  IF r.id IS NULL THEN RAISE EXCEPTION 'project not found'; END IF;
  IF COALESCE(r.answers->>'project_type','') <> 'brand' THEN RAISE EXCEPTION 'not a brand project'; END IF;
  v_role := r.answers->'roles'->p_role_index;
  IF v_role IS NULL OR length(trim(COALESCE(v_role->>'name',''))) = 0 THEN RAISE EXCEPTION 'role not found'; END IF;
  p_name := trim(COALESCE(p_name,'')); p_link := trim(COALESCE(p_link,'')); p_availability := trim(COALESCE(p_availability,''));
  IF length(p_name) = 0 OR length(p_name) > 100 THEN RAISE EXCEPTION 'name required (max 100)'; END IF;
  IF length(p_link) = 0 OR length(p_link) > 500 OR p_link !~* '^https?://' THEN RAISE EXCEPTION 'valid link required'; END IF;
  IF length(p_availability) = 0 OR length(p_availability) > 500 THEN RAISE EXCEPTION 'availability required (max 500)'; END IF;
  IF (SELECT count(*) FROM release_applications WHERE release_id = r.id AND created_at > now() - interval '1 hour') > 50 THEN RAISE EXCEPTION 'too many applications, try later'; END IF;
  INSERT INTO release_applications(release_id, role_index, role_name, name, link, availability)
  VALUES (r.id, p_role_index, v_role->>'name', p_name, p_link, p_availability) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.release_list_applications(p_token text, p_id uuid)
RETURNS SETOF public.release_applications LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.* FROM release_applications a JOIN releases r ON r.id = a.release_id
  WHERE r.id = p_id AND r.owner_token = p_token ORDER BY a.role_index, a.created_at;
$$;

CREATE OR REPLACE FUNCTION public.release_set_application_status(p_token text, p_app_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('applied','hired') THEN RAISE EXCEPTION 'bad status'; END IF;
  UPDATE release_applications a SET status = p_status FROM releases r
  WHERE a.id = p_app_id AND r.id = a.release_id AND r.owner_token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.release_apply(text,int,text,text,text), public.release_list_applications(text,uuid), public.release_set_application_status(text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_apply(text,int,text,text,text), public.release_list_applications(text,uuid), public.release_set_application_status(text,uuid,text) TO anon, authenticated;