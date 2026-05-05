
-- 1) Schema changes
ALTER TABLE public.credit_requests
  ALTER COLUMN project_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS proposed_project_title text;

-- 2) RLS: allow a row with NULL project_id, owned by requester
DROP POLICY IF EXISTS "Project member submits credit_requests" ON public.credit_requests;
CREATE POLICY "Member or new-project submits credit_requests"
ON public.credit_requests
FOR INSERT
WITH CHECK (
  requested_by = auth.uid() AND (
    project_id IS NULL
    OR is_team_member(auth.uid())
    OR is_project_member(auth.uid(), project_id)
  )
);

DROP POLICY IF EXISTS "Team & client read credit_requests" ON public.credit_requests;
CREATE POLICY "Team & owner read credit_requests"
ON public.credit_requests
FOR SELECT
USING (
  is_team_member(auth.uid())
  OR requested_by = auth.uid()
  OR (project_id IS NOT NULL AND is_project_member(auth.uid(), project_id))
);

-- 3) Update team_accept to create a project when none exists
CREATE OR REPLACE FUNCTION public.credit_request_team_accept(
  _request_id uuid,
  _estimated_credits integer,
  _team_notes text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _r public.credit_requests%ROWTYPE;
  _new_project_id uuid;
  _client_name text;
  _client_email text;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'Team only'; END IF;
  IF _estimated_credits IS NULL OR _estimated_credits < 0 THEN RAISE EXCEPTION 'Invalid estimate'; END IF;
  SELECT * INTO _r FROM public.credit_requests WHERE id = _request_id FOR UPDATE;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF _r.status <> 'pending_team' THEN RAISE EXCEPTION 'Request not pending team review'; END IF;

  -- If no project yet, spin one up in pending_approval status and link the requester.
  IF _r.project_id IS NULL THEN
    SELECT display_name, email INTO _client_name, _client_email
      FROM public.profiles WHERE id = _r.requested_by;
    INSERT INTO public.projects (title, client_name, client_email, status)
    VALUES (
      COALESCE(NULLIF(_r.proposed_project_title, ''), _r.title, 'New project'),
      COALESCE(_client_name, _client_email, 'New client'),
      _client_email,
      'pending_approval'
    )
    RETURNING id INTO _new_project_id;

    INSERT INTO public.project_clients (project_id, user_id)
    VALUES (_new_project_id, _r.requested_by)
    ON CONFLICT (project_id, user_id) DO NOTHING;

    UPDATE public.credit_requests
       SET project_id = _new_project_id
     WHERE id = _request_id;
    _r.project_id := _new_project_id;
  END IF;

  UPDATE public.credit_requests
     SET status = 'client_review',
         estimated_credits = _estimated_credits,
         team_notes = COALESCE(_team_notes, team_notes),
         decided_by = auth.uid(),
         team_decided_at = now()
   WHERE id = _request_id;
END;
$function$;

-- 4) Update client_approve to flip pending_approval → active when first approved
CREATE OR REPLACE FUNCTION public.credit_request_client_approve(
  _request_id uuid,
  _client_notes text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _r public.credit_requests%ROWTYPE;
  _balance integer;
  _proj_status text;
BEGIN
  SELECT * INTO _r FROM public.credit_requests WHERE id = _request_id FOR UPDATE;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF _r.project_id IS NULL THEN RAISE EXCEPTION 'Request has no project yet'; END IF;
  IF auth.uid() <> _r.requested_by AND NOT public.is_project_member(auth.uid(), _r.project_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _r.status <> 'client_review' THEN RAISE EXCEPTION 'Not in client review state'; END IF;
  IF _r.estimated_credits IS NULL THEN RAISE EXCEPTION 'No estimate to approve'; END IF;

  SELECT credit_balance, status INTO _balance, _proj_status
    FROM public.projects WHERE id = _r.project_id FOR UPDATE;

  -- For pending_approval projects starting from 0 credits, allow approval
  -- and let the team top them up post-activation. Only block when the project
  -- is already active and lacks credits.
  IF _proj_status = 'active' AND COALESCE(_balance, 0) < _r.estimated_credits THEN
    RAISE EXCEPTION 'Insufficient credit balance (need %, have %)', _r.estimated_credits, COALESCE(_balance,0);
  END IF;

  -- Activate pending project on first approval
  IF _proj_status = 'pending_approval' THEN
    UPDATE public.projects
       SET status = 'active',
           credit_balance = GREATEST(COALESCE(credit_balance, 0) - _r.estimated_credits, 0),
           updated_at = now()
     WHERE id = _r.project_id;
  ELSE
    UPDATE public.projects
       SET credit_balance = credit_balance - _r.estimated_credits,
           updated_at = now()
     WHERE id = _r.project_id;
  END IF;

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
$function$;
