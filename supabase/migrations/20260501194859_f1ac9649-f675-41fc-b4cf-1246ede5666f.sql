ALTER TABLE public.team_availability
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';