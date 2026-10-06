CREATE TABLE public.dm_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starter_id uuid NOT NULL,
  owner_id uuid,
  profile_kind text NOT NULL CHECK (profile_kind IN ('creator','brand')),
  profile_slug text NOT NULL,
  profile_name text NOT NULL DEFAULT '',
  last_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (starter_id, profile_kind, profile_slug)
);
CREATE TABLE public.dm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.dm_messages(thread_id, created_at);
CREATE TABLE public.saved_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_kind text NOT NULL CHECK (profile_kind IN ('creator','brand')),
  profile_slug text NOT NULL,
  profile_name text NOT NULL DEFAULT '',
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, profile_kind, profile_slug)
);
GRANT SELECT ON public.dm_threads TO authenticated;
GRANT SELECT, INSERT ON public.dm_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.saved_profiles TO authenticated;
GRANT ALL ON public.dm_threads, public.dm_messages, public.saved_profiles TO service_role;
ALTER TABLE public.dm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.dm_can_access(_thread uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM dm_threads t WHERE t.id = _thread AND (
    t.starter_id = auth.uid() OR t.owner_id = auth.uid()
    OR (t.owner_id IS NULL AND public.is_team_member(auth.uid()))))
$$;

CREATE POLICY "participants read threads" ON public.dm_threads FOR SELECT TO authenticated USING (public.dm_can_access(id));
CREATE POLICY "participants read messages" ON public.dm_messages FOR SELECT TO authenticated USING (public.dm_can_access(thread_id));
CREATE POLICY "participants send messages" ON public.dm_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.dm_can_access(thread_id));
CREATE POLICY "own saved read" ON public.saved_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own saved add" ON public.saved_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own saved remove" ON public.saved_profiles FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.dm_touch() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE dm_threads SET last_at = now() WHERE id = NEW.thread_id; RETURN NEW; END $$;
CREATE TRIGGER dm_messages_touch AFTER INSERT ON public.dm_messages FOR EACH ROW EXECUTE FUNCTION public.dm_touch();

-- Opens (or returns) the viewer's thread with a profile owner. Unclaimed profiles route to the Rhozeland team.
CREATE OR REPLACE FUNCTION public.dm_open(p_kind text, p_slug text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _owner uuid; _name text; _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  IF p_kind = 'creator' THEN
    SELECT user_id, display_name INTO _owner, _name FROM creator_directory WHERE slug = p_slug;
    IF _name IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;
  ELSIF p_kind = 'brand' THEN
    SELECT user_id, name INTO _owner, _name FROM brand_profiles WHERE slug = p_slug;
    IF _owner IS NULL THEN
      SELECT user_id, coalesce(_name, creator_name) INTO _owner, _name FROM releases
       WHERE status = 'published' AND user_id IS NOT NULL AND rz_slugify(creator_name) = p_slug
       ORDER BY published_at LIMIT 1;
    END IF;
    IF _name IS NULL THEN SELECT creator_name INTO _name FROM releases WHERE status='published' AND rz_slugify(creator_name) = p_slug LIMIT 1; END IF;
    IF _name IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;
  ELSE RAISE EXCEPTION 'bad kind'; END IF;
  IF _owner = _uid THEN RAISE EXCEPTION 'this is your own profile'; END IF;
  INSERT INTO dm_threads (starter_id, owner_id, profile_kind, profile_slug, profile_name)
  VALUES (_uid, _owner, p_kind, p_slug, _name)
  ON CONFLICT (starter_id, profile_kind, profile_slug) DO UPDATE SET owner_id = coalesce(dm_threads.owner_id, EXCLUDED.owner_id)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.dm_open(text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.dm_open(text, text) TO authenticated;