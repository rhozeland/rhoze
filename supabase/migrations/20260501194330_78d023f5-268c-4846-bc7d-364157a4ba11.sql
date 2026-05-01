ALTER TABLE public.team_availability
  ADD COLUMN IF NOT EXISTS slots text[] NOT NULL DEFAULT '{}'::text[];