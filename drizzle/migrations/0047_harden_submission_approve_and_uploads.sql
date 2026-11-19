CREATE OR REPLACE FUNCTION public.community_submission_approve(_submission_id uuid, _points integer, _notes text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _s public.community_submissions%ROWTYPE;
  _cat text;
BEGIN
  IF NOT public.can_edit_community(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _points IS NULL OR _points < 0 THEN RAISE EXCEPTION 'Points must be >= 0'; END IF;
  SELECT * INTO _s FROM public.community_submissions WHERE id = _submission_id FOR UPDATE;
  IF _s.id IS NULL THEN RAISE EXCEPTION 'Submission not found'; END IF;

  UPDATE public.community_submissions
    SET status = 'approved', awarded_points = _points,
        reviewer_notes = COALESCE(_notes, reviewer_notes),
        reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _submission_id;

  _cat := _s.category::text;

  IF EXISTS (SELECT 1 FROM public.community_leaderboard WHERE username = _s.handle) THEN
    UPDATE public.community_leaderboard
      SET points = COALESCE(points,0) + _points,
          weekly_points = COALESCE(weekly_points,0) + _points,
          raids = COALESCE(raids,0) + CASE WHEN _cat = 'raid' THEN 1 ELSE 0 END,
          memes = COALESCE(memes,0) + CASE WHEN _cat = 'meme' THEN 1 ELSE 0 END,
          edu_threads = COALESCE(edu_threads,0) + CASE WHEN _cat = 'thread' THEN 1 ELSE 0 END,
          videos = COALESCE(videos,0) + CASE WHEN _cat = 'video' THEN 1 ELSE 0 END,
          last_updated = CURRENT_DATE
    WHERE username = _s.handle;
  ELSE
    INSERT INTO public.community_leaderboard (username, points, weekly_points, raids, memes, edu_threads, videos, last_updated, published_at)
    VALUES (_s.handle, _points, _points,
      CASE WHEN _cat = 'raid' THEN 1 ELSE 0 END,
      CASE WHEN _cat = 'meme' THEN 1 ELSE 0 END,
      CASE WHEN _cat = 'thread' THEN 1 ELSE 0 END,
      CASE WHEN _cat = 'video' THEN 1 ELSE 0 END,
      CURRENT_DATE, now());
  END IF;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.community_submission_approve(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_submission_approve(uuid, integer, text) TO authenticated;

DROP POLICY IF EXISTS "Anyone uploads application attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone uploads project covers" ON storage.objects;

CREATE POLICY "Members upload own application attachments" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'applications'
  AND owner_id = (select auth.uid()::text)
  AND lower(name) ~ '\.(jpg|jpeg|png|webp|gif|heic|pdf|doc|docx|txt|rtf|key|pptx|mp3|wav|m4a|aac|flac|mp4|mov|webm|zip)$');
CREATE POLICY "Guests upload application attachments" ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'applications'
  AND lower(name) ~ '\.(jpg|jpeg|png|webp|gif|heic|pdf|doc|docx|txt|rtf|key|pptx|mp3|wav|m4a|aac|flac|mp4|mov|webm|zip)$');

CREATE POLICY "Members upload own draft covers" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'covers' AND (storage.foldername(name))[2] = 'drafts'
  AND owner_id = (select auth.uid()::text) AND lower(name) ~ '\.(jpg|jpeg|png|webp)$');
CREATE POLICY "Guests upload draft covers" ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'covers' AND (storage.foldername(name))[2] = 'drafts'
  AND lower(name) ~ '\.(jpg|jpeg|png|webp)$');