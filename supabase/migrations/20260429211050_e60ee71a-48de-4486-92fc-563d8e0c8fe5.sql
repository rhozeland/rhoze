
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS lifetime_spend_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transaction_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_visit date,
  ADD COLUMN IF NOT EXISTS last_visit date,
  ADD COLUMN IF NOT EXISTS ig_handle text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS relationship_status text;

CREATE INDEX IF NOT EXISTS contacts_ig_handle_idx ON public.contacts (lower(ig_handle));
CREATE INDEX IF NOT EXISTS contacts_source_idx ON public.contacts (source);

CREATE TABLE IF NOT EXISTS public.ig_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle text NOT NULL UNIQUE,
  profile_link text,
  status text,
  total_messages integer NOT NULL DEFAULT 0,
  their_replies integer NOT NULL DEFAULT 0,
  key_topics text,
  last_message_date timestamptz,
  snippet text,
  is_follower boolean NOT NULL DEFAULT false,
  follows_us boolean NOT NULL DEFAULT false,
  pending_request boolean NOT NULL DEFAULT false,
  has_dm_history boolean NOT NULL DEFAULT false,
  commenter boolean NOT NULL DEFAULT false,
  notes text,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ig_threads_status_idx ON public.ig_threads (status);
CREATE INDEX IF NOT EXISTS ig_threads_last_idx ON public.ig_threads (last_message_date DESC NULLS LAST);

ALTER TABLE public.ig_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team reads ig_threads" ON public.ig_threads FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Team writes ig_threads" ON public.ig_threads FOR INSERT TO authenticated WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "Team updates ig_threads" ON public.ig_threads FOR UPDATE TO authenticated USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "Admins delete ig_threads" ON public.ig_threads FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER ig_threads_updated BEFORE UPDATE ON public.ig_threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
