
-- Sanitize existing email-shaped usernames on the public leaderboard
UPDATE public.community_leaderboard
SET username = '@' || split_part(regexp_replace(username, '^@', ''), '@', 1)
WHERE username ~ '@[^@]+@';

UPDATE public.community_leaderboard
SET username = '@' || split_part(username, '@', 1)
WHERE username ~ '^[^@]+@[^@]+\.[^@]+$';

-- Prevent email-like values from being stored as usernames going forward
ALTER TABLE public.community_leaderboard
  DROP CONSTRAINT IF EXISTS community_leaderboard_username_not_email;

ALTER TABLE public.community_leaderboard
  ADD CONSTRAINT community_leaderboard_username_not_email
  CHECK (username !~ '@[^@\s]+\.[^@\s]+$');
