
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'revoked');

CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'employee',
  status invite_status NOT NULL DEFAULT 'pending',
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  user_id uuid,
  note text
);

CREATE INDEX idx_team_invites_email ON public.team_invites (lower(email));

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read invites" ON public.team_invites
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert invites" ON public.team_invites
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update invites" ON public.team_invites
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete invites" ON public.team_invites
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
