ALTER TABLE public.project_milestones
  ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE public.project_payments
  ADD COLUMN IF NOT EXISTS milestone_id uuid REFERENCES public.project_milestones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_payments_milestone_id ON public.project_payments(milestone_id);