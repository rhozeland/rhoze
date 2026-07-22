
ALTER TABLE public.milestone_messages
  ADD COLUMN IF NOT EXISTS caption_path text,
  ADD COLUMN IF NOT EXISTS caption_name text,
  ADD COLUMN IF NOT EXISTS caption_mime text;
