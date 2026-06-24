
-- Submission category enum
DO $$ BEGIN
  CREATE TYPE public.community_submission_category AS ENUM ('raid','meme','thread','video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.community_submission_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.community_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  handle text NOT NULL,
  category public.community_submission_category NOT NULL,
  post_url text NOT NULL,
  status public.community_submission_status NOT NULL DEFAULT 'pending',
  awarded_points integer NOT NULL DEFAULT 0,
  reviewer_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_submissions TO authenticated;
GRANT ALL ON public.community_submissions TO service_role;

ALTER TABLE public.community_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submitters insert own" ON public.community_submissions;
CREATE POLICY "submitters insert own"
  ON public.community_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "submitters select own" ON public.community_submissions;
CREATE POLICY "submitters select own"
  ON public.community_submissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.can_edit_community(auth.uid()));

DROP POLICY IF EXISTS "reviewers manage all" ON public.community_submissions;
CREATE POLICY "reviewers manage all"
  ON public.community_submissions FOR ALL TO authenticated
  USING (public.can_edit_community(auth.uid()))
  WITH CHECK (public.can_edit_community(auth.uid()));

CREATE TRIGGER trg_community_submissions_updated
  BEFORE UPDATE ON public.community_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Approve helper: marks submission approved + bumps leaderboard row for the handle.
CREATE OR REPLACE FUNCTION public.community_submission_approve(
  _submission_id uuid,
  _points integer,
  _notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Map category → leaderboard counter column
  _col := CASE _s.category
    WHEN 'raid' THEN 'raids'
    WHEN 'meme' THEN 'memes'
    WHEN 'thread' THEN 'edu_threads'
    WHEN 'video' THEN 'videos'
  END;

  -- Upsert leaderboard row by handle (matching on username).
  IF EXISTS (SELECT 1 FROM public.community_leaderboard WHERE username = _s.handle) THEN
    EXECUTE format(
      'UPDATE public.community_leaderboard
          SET points = COALESCE(points,0) + $1,
              %I = COALESCE(%I,0) + 1,
              last_updated = CURRENT_DATE
        WHERE username = $2', _col, _col)
    USING _points, _s.handle;
  ELSE
    EXECUTE format(
      'INSERT INTO public.community_leaderboard (username, points, %I, last_updated)
         VALUES ($1, $2, 1, CURRENT_DATE)', _col)
    USING _s.handle, _points;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_submission_reject(
  _submission_id uuid,
  _notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_edit_community(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.community_submissions
    SET status = 'rejected',
        reviewer_notes = COALESCE(_notes, reviewer_notes),
        reviewed_by = auth.uid(),
        reviewed_at = now()
  WHERE id = _submission_id;
END;
$$;
