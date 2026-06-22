-- 1) New role for marketing leaderboard editors (compare via text to avoid enum-not-committed errors)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marketing';

CREATE OR REPLACE FUNCTION public.can_edit_community(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role::text IN ('admin','marketing')
  )
$$;

-- 2) Leaderboard entries
CREATE TABLE public.community_leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  raids integer NOT NULL DEFAULT 0,
  memes integer NOT NULL DEFAULT 0,
  edu_threads integer NOT NULL DEFAULT 0,
  videos integer NOT NULL DEFAULT 0,
  challenges_completed integer NOT NULL DEFAULT 0,
  last_updated date NOT NULL DEFAULT CURRENT_DATE,
  published_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.community_leaderboard TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_leaderboard TO authenticated;
GRANT ALL ON public.community_leaderboard TO service_role;

ALTER TABLE public.community_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published leaderboard"
  ON public.community_leaderboard FOR SELECT
  USING (published_at IS NOT NULL);

CREATE POLICY "Editors can read all leaderboard"
  ON public.community_leaderboard FOR SELECT TO authenticated
  USING (public.can_edit_community(auth.uid()));

CREATE POLICY "Editors can insert leaderboard"
  ON public.community_leaderboard FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_community(auth.uid()));

CREATE POLICY "Editors can update leaderboard"
  ON public.community_leaderboard FOR UPDATE TO authenticated
  USING (public.can_edit_community(auth.uid()))
  WITH CHECK (public.can_edit_community(auth.uid()));

CREATE POLICY "Editors can delete leaderboard"
  ON public.community_leaderboard FOR DELETE TO authenticated
  USING (public.can_edit_community(auth.uid()));

CREATE TRIGGER trg_community_leaderboard_updated_at
  BEFORE UPDATE ON public.community_leaderboard
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Weekly challenges
CREATE TABLE public.community_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_label text NOT NULL,
  theme text NOT NULL,
  description text,
  multiplier numeric(4,2) NOT NULL DEFAULT 1.0,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.community_challenges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_challenges TO authenticated;
GRANT ALL ON public.community_challenges TO service_role;

ALTER TABLE public.community_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read challenges"
  ON public.community_challenges FOR SELECT USING (true);

CREATE POLICY "Editors can write challenges"
  ON public.community_challenges FOR ALL TO authenticated
  USING (public.can_edit_community(auth.uid()))
  WITH CHECK (public.can_edit_community(auth.uid()));

CREATE TRIGGER trg_community_challenges_updated_at
  BEFORE UPDATE ON public.community_challenges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Points rules reference
CREATE TABLE public.community_points_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity text NOT NULL,
  base_points integer NOT NULL,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.community_points_rules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_points_rules TO authenticated;
GRANT ALL ON public.community_points_rules TO service_role;

ALTER TABLE public.community_points_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read points rules"
  ON public.community_points_rules FOR SELECT USING (true);

CREATE POLICY "Editors can write points rules"
  ON public.community_points_rules FOR ALL TO authenticated
  USING (public.can_edit_community(auth.uid()))
  WITH CHECK (public.can_edit_community(auth.uid()));

CREATE TRIGGER trg_community_points_rules_updated_at
  BEFORE UPDATE ON public.community_points_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Seed data (from rhoze_community_tracker.xlsx)
INSERT INTO public.community_leaderboard
  (username, points, raids, memes, edu_threads, videos, challenges_completed, last_updated, published_at, sort_order)
VALUES
  ('@UserA', 420, 5, 3, 2, 2, 12, '2026-06-16', now(), 1),
  ('@UserB', 390, 4, 4, 1, 1, 10, '2026-06-16', now(), 2),
  ('@UserC', 355, 3, 2, 3, 1, 9,  '2026-06-16', now(), 3),
  ('@UserD', 310, 2, 3, 2, 1, 8,  '2026-06-15', now(), 4),
  ('@UserE', 280, 4, 1, 1, 1, 7,  '2026-06-16', now(), 5);

INSERT INTO public.community_challenges
  (week_label, theme, description, multiplier, start_date, end_date, is_active)
VALUES
  ('Week 1', 'Raiding',              'Raid $RHOZE mentions across X/Telegram', 1.5, '2026-06-16','2026-06-22', false),
  ('Week 2', 'Memes',                'Create and post $RHOZE memes',           1.5, '2026-06-23','2026-06-29', true),
  ('Week 3', 'Educational Threads',  'Post threads on Web3/creators/Solana',   2.0, '2026-06-30','2026-07-06', false),
  ('Week 4', 'Video Content',        'Short videos, clips, music reactions',   2.0, '2026-07-07','2026-07-13', false);

INSERT INTO public.community_points_rules
  (activity, base_points, notes, sort_order)
VALUES
  ('Raid (quality post)',       10, 'Tag @rhozeland + $RHOZE', 1),
  ('Meme post',                 15, 'Original content',         2),
  ('Educational thread',        25, '3+ tweets',                3),
  ('Video content',             30, '30s+',                     4),
  ('Referral (new user joins)', 50, 'Verified',                 5),
  ('Weekly top 3 bonus',       100, 'Extra airdrop potential',  6);