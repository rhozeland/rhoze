CREATE TABLE public.release_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  position int NOT NULL,
  title text NOT NULL DEFAULT '',
  amount_cents int NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','funded','approved','paid')),
  assignees jsonb NOT NULL DEFAULT '[]'::jsonb,
  funded_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (release_id, position)
);
GRANT SELECT ON public.release_milestones TO authenticated;
GRANT ALL ON public.release_milestones TO service_role;
ALTER TABLE public.release_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins read milestones" ON public.release_milestones FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.user_id = auth.uid()));

CREATE TABLE public.release_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.release_milestones(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'milestone',
  amount_cents int NOT NULL,
  currency text NOT NULL DEFAULT 'cad',
  stripe_session_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.release_payments TO authenticated;
GRANT ALL ON public.release_payments TO service_role;
ALTER TABLE public.release_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins read payments" ON public.release_payments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.user_id = auth.uid()));

CREATE TABLE public.release_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES public.release_milestones(id) ON DELETE CASCADE,
  team_member_id uuid,
  recipient_name text NOT NULL,
  recipient_email text,
  amount_cents int NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent')),
  reference text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.release_payouts TO authenticated;
GRANT ALL ON public.release_payouts TO service_role;
ALTER TABLE public.release_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners, admins and recipients read payouts" ON public.release_payouts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin')
  OR (recipient_email IS NOT NULL AND lower(recipient_email) = lower(auth.jwt()->>'email'))
  OR EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.user_id = auth.uid()));
CREATE INDEX release_milestones_release_idx ON public.release_milestones(release_id);
CREATE INDEX release_payouts_status_idx ON public.release_payouts(status);

CREATE OR REPLACE FUNCTION public.release_sync_milestones(p_id uuid)
RETURNS SETOF public.release_milestones LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.releases; n int;
BEGIN
  SELECT * INTO r FROM public.releases WHERE id = p_id;
  IF r.id IS NULL OR r.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not allowed'; END IF;
  INSERT INTO public.release_milestones(release_id, position, title, amount_cents, due_date)
  SELECT p_id, (e.ord - 1)::int, left(coalesce(e.m->>'title',''),200),
         greatest(0, coalesce((e.m->>'amount_cents')::numeric,0))::int,
         nullif(e.m->>'due_date','')::date
  FROM jsonb_array_elements(coalesce(r.milestones,'[]'::jsonb)) WITH ORDINALITY AS e(m, ord)
  ON CONFLICT (release_id, position) DO UPDATE
    SET title = EXCLUDED.title, amount_cents = EXCLUDED.amount_cents,
        due_date = coalesce(EXCLUDED.due_date, release_milestones.due_date)
    WHERE release_milestones.status = 'planned';
  n := jsonb_array_length(coalesce(r.milestones,'[]'::jsonb));
  DELETE FROM public.release_milestones WHERE release_id = p_id AND position >= n AND status = 'planned';
  RETURN QUERY SELECT * FROM public.release_milestones WHERE release_id = p_id ORDER BY position;
END $$;

CREATE OR REPLACE FUNCTION public.release_set_milestone_plan(p_milestone_id uuid, p_due_date date, p_assignees jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.release_milestones; total numeric;
BEGIN
  SELECT * INTO m FROM public.release_milestones WHERE id = p_milestone_id;
  IF m.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.releases WHERE id = m.release_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF m.status IN ('approved','paid') THEN RAISE EXCEPTION 'milestone already approved'; END IF;
  IF jsonb_typeof(coalesce(p_assignees,'[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'invalid assignees'; END IF;
  SELECT coalesce(sum((a->>'pct')::numeric),0) INTO total FROM jsonb_array_elements(coalesce(p_assignees,'[]'::jsonb)) a;
  IF jsonb_array_length(coalesce(p_assignees,'[]'::jsonb)) > 0 AND round(total) <> 100 THEN RAISE EXCEPTION 'shares must total 100%%'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_assignees,'[]'::jsonb)) a
             WHERE NOT EXISTS (SELECT 1 FROM public.release_team_members t WHERE t.id::text = a->>'member_id' AND t.release_id = m.release_id)) THEN
    RAISE EXCEPTION 'unknown collaborator'; END IF;
  UPDATE public.release_milestones SET due_date = p_due_date, assignees = coalesce(p_assignees,'[]'::jsonb) WHERE id = p_milestone_id;
END $$;

CREATE OR REPLACE FUNCTION public.release_approve_milestone(p_milestone_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.release_milestones; r public.releases; pool numeric;
BEGIN
  SELECT * INTO m FROM public.release_milestones WHERE id = p_milestone_id FOR UPDATE;
  SELECT * INTO r FROM public.releases WHERE id = m.release_id;
  IF m.id IS NULL OR r.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF m.status <> 'funded' THEN RAISE EXCEPTION 'milestone must be paid before approval'; END IF;
  IF jsonb_array_length(m.assignees) = 0 THEN RAISE EXCEPTION 'assign collaborators first'; END IF;
  pool := m.amount_cents * (100 - coalesce(r.fee_pct,0)) / 100.0;
  INSERT INTO public.release_payouts(release_id, milestone_id, team_member_id, recipient_name, recipient_email, amount_cents)
  SELECT m.release_id, m.id, t.id, t.display_name, t.email, floor(pool * (a->>'pct')::numeric / 100)::int
  FROM jsonb_array_elements(m.assignees) a JOIN public.release_team_members t ON t.id::text = a->>'member_id' AND t.release_id = m.release_id;
  UPDATE public.release_milestones SET status = 'approved', approved_at = now() WHERE id = m.id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_mark_payout_sent(p_payout_id uuid, p_reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not allowed'; END IF;
  UPDATE public.release_payouts SET status = 'sent', sent_at = now(), reference = left(p_reference,200)
  WHERE id = p_payout_id AND status = 'pending' RETURNING milestone_id INTO mid;
  IF mid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.release_payouts WHERE milestone_id = mid AND status = 'pending') THEN
    UPDATE public.release_milestones SET status = 'paid' WHERE id = mid AND status = 'approved';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.release_record_payment(p_session_id text, p_milestone_id uuid, p_amount_cents int, p_currency text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.release_milestones;
BEGIN
  SELECT * INTO m FROM public.release_milestones WHERE id = p_milestone_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'unknown milestone'; END IF;
  INSERT INTO public.release_payments(release_id, milestone_id, kind, amount_cents, currency, stripe_session_id)
  VALUES (m.release_id, m.id, CASE WHEN m.position = 0 THEN 'deposit' ELSE 'milestone' END, p_amount_cents, coalesce(p_currency,'cad'), p_session_id)
  ON CONFLICT (stripe_session_id) DO NOTHING;
  IF FOUND AND m.status = 'planned' AND p_amount_cents >= m.amount_cents THEN
    UPDATE public.release_milestones SET status = 'funded', funded_at = now() WHERE id = m.id;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.release_record_payment(text, uuid, int, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_record_payment(text, uuid, int, text) TO service_role;
REVOKE ALL ON FUNCTION public.release_sync_milestones(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_set_milestone_plan(uuid, date, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_approve_milestone(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_mark_payout_sent(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_sync_milestones(uuid), public.release_set_milestone_plan(uuid, date, jsonb), public.release_approve_milestone(uuid), public.admin_mark_payout_sent(uuid, text) TO authenticated;