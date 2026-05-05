
-- Credit requests: clients request work paid for with their credit balance
CREATE TYPE public.credit_request_status AS ENUM (
  'pending_team',   -- client submitted, awaiting team review
  'client_review',  -- team accepted with estimate, awaiting client approval
  'accepted',       -- client approved, credits deducted, work in progress
  'rejected',       -- team rejected
  'cancelled',      -- client cancelled
  'completed'       -- team marked done
);

CREATE TABLE public.credit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  kind text NOT NULL DEFAULT 'custom', -- 'catalog' | 'custom'
  package_id uuid,
  title text NOT NULL,
  description text,
  requested_credits integer NOT NULL DEFAULT 1,
  estimated_credits integer,           -- team's estimate
  final_credits integer,               -- locked at client approval
  status public.credit_request_status NOT NULL DEFAULT 'pending_team',
  team_notes text,
  client_notes text,
  decided_by uuid,
  team_decided_at timestamptz,
  client_decided_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_requests_project ON public.credit_requests(project_id);
CREATE INDEX idx_credit_requests_status ON public.credit_requests(status);

ALTER TABLE public.credit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team & client read credit_requests"
  ON public.credit_requests FOR SELECT
  USING (public.is_team_member(auth.uid()) OR public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project member submits credit_requests"
  ON public.credit_requests FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND (public.is_team_member(auth.uid()) OR public.is_project_member(auth.uid(), project_id))
  );

CREATE POLICY "Team or owner updates credit_requests"
  ON public.credit_requests FOR UPDATE
  USING (
    public.is_team_member(auth.uid())
    OR (requested_by = auth.uid() AND status IN ('pending_team','client_review'))
  )
  WITH CHECK (
    public.is_team_member(auth.uid())
    OR (requested_by = auth.uid() AND status IN ('pending_team','client_review','cancelled'))
  );

CREATE POLICY "Admin deletes credit_requests"
  ON public.credit_requests FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_credit_requests_updated_at
  BEFORE UPDATE ON public.credit_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Team accepts with an estimate; moves to client_review
CREATE OR REPLACE FUNCTION public.credit_request_team_accept(
  _request_id uuid,
  _estimated_credits integer,
  _team_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _r public.credit_requests%ROWTYPE;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'Team only'; END IF;
  IF _estimated_credits IS NULL OR _estimated_credits < 0 THEN RAISE EXCEPTION 'Invalid estimate'; END IF;
  SELECT * INTO _r FROM public.credit_requests WHERE id = _request_id FOR UPDATE;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF _r.status <> 'pending_team' THEN RAISE EXCEPTION 'Request not pending team review'; END IF;
  UPDATE public.credit_requests
     SET status = 'client_review',
         estimated_credits = _estimated_credits,
         team_notes = COALESCE(_team_notes, team_notes),
         decided_by = auth.uid(),
         team_decided_at = now()
   WHERE id = _request_id;
END;
$$;

-- Team rejects
CREATE OR REPLACE FUNCTION public.credit_request_team_reject(
  _request_id uuid,
  _team_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'Team only'; END IF;
  UPDATE public.credit_requests
     SET status = 'rejected',
         team_notes = COALESCE(_team_notes, team_notes),
         decided_by = auth.uid(),
         team_decided_at = now()
   WHERE id = _request_id AND status IN ('pending_team','client_review');
END;
$$;

-- Client approves; deducts credits and creates a line item
CREATE OR REPLACE FUNCTION public.credit_request_client_approve(
  _request_id uuid,
  _client_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _r public.credit_requests%ROWTYPE;
  _balance integer;
BEGIN
  SELECT * INTO _r FROM public.credit_requests WHERE id = _request_id FOR UPDATE;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF auth.uid() <> _r.requested_by AND NOT public.is_project_member(auth.uid(), _r.project_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _r.status <> 'client_review' THEN RAISE EXCEPTION 'Not in client review state'; END IF;
  IF _r.estimated_credits IS NULL THEN RAISE EXCEPTION 'No estimate to approve'; END IF;

  SELECT credit_balance INTO _balance FROM public.projects WHERE id = _r.project_id FOR UPDATE;
  IF COALESCE(_balance, 0) < _r.estimated_credits THEN
    RAISE EXCEPTION 'Insufficient credit balance (need %, have %)', _r.estimated_credits, COALESCE(_balance,0);
  END IF;

  -- Deduct credits
  UPDATE public.projects
     SET credit_balance = credit_balance - _r.estimated_credits,
         updated_at = now()
   WHERE id = _r.project_id;

  -- Create a line item recording the spend
  INSERT INTO public.project_line_items (
    project_id, deliverable, description, credits_used, debit_kind, status, created_by
  ) VALUES (
    _r.project_id, _r.title, _r.description, _r.estimated_credits, 'credit', 'planned', _r.requested_by
  );

  UPDATE public.credit_requests
     SET status = 'accepted',
         final_credits = _r.estimated_credits,
         client_notes = COALESCE(_client_notes, client_notes),
         client_decided_at = now()
   WHERE id = _request_id;
END;
$$;

-- Client cancels (only while still pending or in review)
CREATE OR REPLACE FUNCTION public.credit_request_cancel(_request_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _r public.credit_requests%ROWTYPE;
BEGIN
  SELECT * INTO _r FROM public.credit_requests WHERE id = _request_id FOR UPDATE;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF auth.uid() <> _r.requested_by AND NOT public.is_team_member(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _r.status NOT IN ('pending_team','client_review') THEN
    RAISE EXCEPTION 'Cannot cancel in this state';
  END IF;
  UPDATE public.credit_requests SET status = 'cancelled' WHERE id = _request_id;
END;
$$;

-- Team marks completed
CREATE OR REPLACE FUNCTION public.credit_request_complete(_request_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'Team only'; END IF;
  UPDATE public.credit_requests
     SET status = 'completed', completed_at = now()
   WHERE id = _request_id AND status = 'accepted';
END;
$$;
