ALTER TABLE public.docs
ADD COLUMN IF NOT EXISTS tag_department department;

CREATE INDEX IF NOT EXISTS idx_docs_tag_department ON public.docs (tag_department);