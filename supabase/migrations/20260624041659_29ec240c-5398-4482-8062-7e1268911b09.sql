
-- 1) Profiles: community fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payment_email text,
  ADD COLUMN IF NOT EXISTS social_handle text,
  ADD COLUMN IF NOT EXISTS community_username text;

-- 2) Leaderboard: weekly counter
ALTER TABLE public.community_leaderboard
  ADD COLUMN IF NOT EXISTS weekly_points integer NOT NULL DEFAULT 0;

-- 3) Expand category enum. Convert column to text, drop enum, recreate, convert back.
ALTER TABLE public.community_submissions
  ALTER COLUMN category TYPE text USING category::text;

DROP TYPE IF EXISTS community_submission_category;

CREATE TYPE community_submission_category AS ENUM
  ('raid','meme','tweet','thread','infographic','video','bounty');

ALTER TABLE public.community_submissions
  ALTER COLUMN category TYPE community_submission_category
  USING category::community_submission_category;

-- 4) Approve function: bump weekly_points, tolerate new categories
CREATE OR REPLACE FUNCTION public.community_submission_approve(
  _submission_id uuid, _points integer, _notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _s public.community_submissions%ROWTYPE;
  _col text;
BEGIN
  IF NOT public.can_edit_community(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _points IS NULL OR _points < 0 THEN
    RAISE EXCEPTION 'Points must be >= 0';
  END IF;

  SELECT * INTO _s FROM public.community_submissions WHERE id = _submission_id FOR UPDATE;
  IF _s.id IS NULL THEN RAISE EXCEPTION 'Submission not found'; END IF;

  UPDATE public.community_submissions
    SET status = 'approved',
        awarded_points = _points,
        reviewer_notes = COALESCE(_notes, reviewer_notes),
        reviewed_by = auth.uid(),
        reviewed_at = now()
  WHERE id = _submission_id;

  _col := CASE _s.category::text
    WHEN 'raid' THEN 'raids'
    WHEN 'meme' THEN 'memes'
    WHEN 'thread' THEN 'edu_threads'
    WHEN 'video' THEN 'videos'
    ELSE NULL
  END;

  IF EXISTS (SELECT 1 FROM public.community_leaderboard WHERE username = _s.handle) THEN
    IF _col IS NOT NULL THEN
      EXECUTE format(
        'UPDATE public.community_leaderboard
            SET points = COALESCE(points,0) + $1,
                weekly_points = COALESCE(weekly_points,0) + $1,
                %I = COALESCE(%I,0) + 1,
                last_updated = CURRENT_DATE
          WHERE username = $2', _col, _col)
      USING _points, _s.handle;
    ELSE
      UPDATE public.community_leaderboard
        SET points = COALESCE(points,0) + _points,
            weekly_points = COALESCE(weekly_points,0) + _points,
            last_updated = CURRENT_DATE
      WHERE username = _s.handle;
    END IF;
  ELSE
    IF _col IS NOT NULL THEN
      EXECUTE format(
        'INSERT INTO public.community_leaderboard (username, points, weekly_points, %I, last_updated, published_at)
           VALUES ($1, $2, $2, 1, CURRENT_DATE, now())', _col)
      USING _s.handle, _points;
    ELSE
      INSERT INTO public.community_leaderboard (username, points, weekly_points, last_updated, published_at)
        VALUES (_s.handle, _points, _points, CURRENT_DATE, now());
    END IF;
  END IF;
END;
$function$;

-- 5) Reset weekly points
CREATE OR REPLACE FUNCTION public.community_reset_weekly_points()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_edit_community(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.community_leaderboard SET weekly_points = 0;
END;
$$;

-- 6) Refresh points rules
DELETE FROM public.community_points_rules;
INSERT INTO public.community_points_rules (activity, base_points, notes, sort_order) VALUES
  ('Raid (reply / comment / reshare)', 5, 'Reply on X, YouTube, TikTok, IG, or reshare', 1),
  ('Raid with a meme', 10, 'Reply with an original meme', 2),
  ('Original tweet about Rhozeland', 15, 'Single tweet with original thoughts', 3),
  ('Thread (4+ posts)', 25, 'Minimum 4 connected posts', 4),
  ('Infographic', 35, 'Original graphic about the project', 5),
  ('Video (AI assisted ok)', 45, 'Original video content', 6),
  ('Rhozeland bounty', 50, 'Participate in an official bounty', 7);
