CREATE TABLE public.creator_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  photo_url text,
  disciplines text[] NOT NULL DEFAULT '{}',
  membership_tier text NOT NULL DEFAULT 'Spark' CHECK (membership_tier IN ('Spark', 'Glow')),
  hourly_rate_cents integer CHECK (hourly_rate_cents >= 0),
  completed_projects integer NOT NULL DEFAULT 0 CHECK (completed_projects >= 0),
  rating numeric(2,1) CHECK (rating BETWEEN 0 AND 5),
  trending boolean NOT NULL DEFAULT false,
  bio text,
  portfolio_url text,
  website_url text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.creator_directory TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.creator_directory TO authenticated;
GRANT ALL ON public.creator_directory TO service_role;
ALTER TABLE public.creator_directory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visitors view approved creators" ON public.creator_directory FOR SELECT TO anon, authenticated USING (approved = true OR public.is_team_member(auth.uid()));
CREATE POLICY "Team adds creators" ON public.creator_directory FOR INSERT TO authenticated WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "Team updates creators" ON public.creator_directory FOR UPDATE TO authenticated USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "Team removes creators" ON public.creator_directory FOR DELETE TO authenticated USING (public.is_team_member(auth.uid()));
CREATE TRIGGER creator_directory_updated_at BEFORE UPDATE ON public.creator_directory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();