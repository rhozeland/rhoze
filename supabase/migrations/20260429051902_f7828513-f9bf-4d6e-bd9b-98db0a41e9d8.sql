
-- Add 'client' role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';

-- =========================
-- service_packages (catalog)
-- =========================
CREATE TABLE IF NOT EXISTS public.service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'subscription', -- 'subscription' | 'a_la_carte'
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  credits integer NOT NULL DEFAULT 0,
  billing_interval text, -- 'month' | NULL
  stripe_price_id text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active packages" ON public.service_packages
  FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage packages" ON public.service_packages
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_service_packages_updated BEFORE UPDATE ON public.service_packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- projects
-- =========================
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  client_name text NOT NULL,
  client_email text,
  client_phone text,
  status text NOT NULL DEFAULT 'active', -- 'pending' | 'active' | 'paused' | 'completed' | 'cancelled'
  package_id uuid REFERENCES public.service_packages(id) ON DELETE SET NULL,
  dollar_balance_cents integer NOT NULL DEFAULT 0,
  credit_balance integer NOT NULL DEFAULT 0,
  notes text,
  project_code text UNIQUE, -- one-time client redemption code
  stripe_customer_id text,
  stripe_subscription_id text,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- project_clients (link client users to projects)
-- =========================
CREATE TABLE IF NOT EXISTS public.project_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
ALTER TABLE public.project_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage project_clients" ON public.project_clients
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users see own project_clients" ON public.project_clients
  FOR SELECT USING (user_id = auth.uid() OR is_team_member(auth.uid()));

-- helper: is project member (client)
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_clients
    WHERE user_id = _user_id AND project_id = _project_id
  )
$$;

-- projects RLS (after helper exists)
CREATE POLICY "Team reads projects" ON public.projects
  FOR SELECT USING (is_team_member(auth.uid()) OR is_project_member(auth.uid(), id));
CREATE POLICY "Admins write projects" ON public.projects
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update projects" ON public.projects
  FOR UPDATE USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete projects" ON public.projects
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- =========================
-- project_payments
-- =========================
CREATE TABLE IF NOT EXISTS public.project_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  due_date date,
  paid_date date,
  method text, -- 'e-transfer' | 'cash' | 'stripe' | 'other'
  stripe_payment_intent_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team & client read payments" ON public.project_payments
  FOR SELECT USING (
    is_team_member(auth.uid()) OR is_project_member(auth.uid(), project_id)
  );
CREATE POLICY "Admins manage payments" ON public.project_payments
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_project_payments_updated BEFORE UPDATE ON public.project_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- project_line_items (deliverables/sessions)
-- =========================
CREATE TABLE IF NOT EXISTS public.project_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  booking_date date,
  location text,
  deliverable text NOT NULL,
  description text,
  session_hours numeric DEFAULT 0,
  base_amount_cents integer NOT NULL DEFAULT 0,
  discount_cents integer NOT NULL DEFAULT 0,
  grand_total_cents integer NOT NULL DEFAULT 0,
  debit_kind text NOT NULL DEFAULT 'dollar', -- 'dollar' | 'credit'
  credits_used integer NOT NULL DEFAULT 0,
  payment_method text,
  status text NOT NULL DEFAULT 'planned', -- 'planned' | 'pending_approval' | 'approved' | 'completed'
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team & client read line items" ON public.project_line_items
  FOR SELECT USING (
    is_team_member(auth.uid()) OR is_project_member(auth.uid(), project_id)
  );
CREATE POLICY "Team writes line items" ON public.project_line_items
  FOR INSERT WITH CHECK (is_team_member(auth.uid()));
CREATE POLICY "Team updates line items" ON public.project_line_items
  FOR UPDATE USING (is_team_member(auth.uid()))
  WITH CHECK (is_team_member(auth.uid()));
CREATE POLICY "Admins delete line items" ON public.project_line_items
  FOR DELETE USING (has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_project_line_items_updated BEFORE UPDATE ON public.project_line_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- redeem_project_code function
-- =========================
CREATE OR REPLACE FUNCTION public.redeem_project_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _project_id uuid;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO _project_id FROM public.projects WHERE project_code = _code FOR UPDATE LIMIT 1;
  IF _project_id IS NULL THEN RAISE EXCEPTION 'Invalid project code'; END IF;
  INSERT INTO public.project_clients (project_id, user_id) VALUES (_project_id, _uid)
    ON CONFLICT (project_id, user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'client')
    ON CONFLICT (user_id, role) DO NOTHING;
  -- one-time use: clear the code
  UPDATE public.projects SET project_code = NULL WHERE id = _project_id;
  RETURN _project_id;
END;
$$;

-- =========================
-- timesheet_periods
-- =========================
CREATE TABLE IF NOT EXISTS public.timesheet_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  pay_date date NOT NULL,
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.timesheet_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team reads periods" ON public.timesheet_periods FOR SELECT
  USING (is_team_member(auth.uid()));
CREATE POLICY "Admins manage periods" ON public.timesheet_periods FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- =========================
-- timesheets
-- =========================
CREATE TABLE IF NOT EXISTS public.timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_id uuid NOT NULL REFERENCES public.timesheet_periods(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft', -- 'draft' | 'submitted' | 'approved' | 'paid'
  work_summary text,
  next_period_goals text,
  notes text,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_id)
);
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or admin reads timesheets" ON public.timesheets FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner inserts own timesheet" ON public.timesheets FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_team_member(auth.uid()));
CREATE POLICY "Owner or admin updates timesheet" ON public.timesheets FOR UPDATE
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete timesheets" ON public.timesheets FOR DELETE
  USING (has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_timesheets_updated BEFORE UPDATE ON public.timesheets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- timesheet_entries
-- =========================
CREATE TABLE IF NOT EXISTS public.timesheet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id uuid NOT NULL REFERENCES public.timesheets(id) ON DELETE CASCADE,
  deliverable text NOT NULL,
  work_type text NOT NULL DEFAULT 'standard', -- 'project' | 'specialist' | 'standard'
  rate_amount_cents integer NOT NULL DEFAULT 0,
  day date,
  start_time timestamptz,
  end_time timestamptz,
  hours numeric NOT NULL DEFAULT 0,
  expense_cents integer NOT NULL DEFAULT 0,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or admin reads entries" ON public.timesheet_entries FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.timesheets t WHERE t.id = timesheet_id
      AND (t.user_id = auth.uid() OR has_role(auth.uid(), 'admin')))
  );
CREATE POLICY "Owner writes entries" ON public.timesheet_entries FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.timesheets t WHERE t.id = timesheet_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Owner or admin updates entries" ON public.timesheet_entries FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.timesheets t WHERE t.id = timesheet_id
      AND (t.user_id = auth.uid() OR has_role(auth.uid(), 'admin')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.timesheets t WHERE t.id = timesheet_id
      AND (t.user_id = auth.uid() OR has_role(auth.uid(), 'admin')))
  );
CREATE POLICY "Owner or admin deletes entries" ON public.timesheet_entries FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.timesheets t WHERE t.id = timesheet_id
      AND (t.user_id = auth.uid() OR has_role(auth.uid(), 'admin')))
  );

-- =========================
-- intake_requests (public form)
-- =========================
CREATE TABLE IF NOT EXISTS public.intake_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  package_id uuid REFERENCES public.service_packages(id) ON DELETE SET NULL,
  cart jsonb NOT NULL DEFAULT '[]'::jsonb,
  message text,
  contract_accepted boolean NOT NULL DEFAULT false,
  contract_accepted_at timestamptz,
  deposit_cents integer NOT NULL DEFAULT 0,
  subscribe_monthly boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'converted' | 'cancelled'
  stripe_session_id text,
  stripe_payment_intent_id text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.intake_requests ENABLE ROW LEVEL SECURITY;
-- Public can insert (anonymous intake form); admins manage
CREATE POLICY "Anyone submits intake" ON public.intake_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins read intake" ON public.intake_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update intake" ON public.intake_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete intake" ON public.intake_requests FOR DELETE
  USING (has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_intake_updated BEFORE UPDATE ON public.intake_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- Seed catalog from sales doc
-- =========================
INSERT INTO public.service_packages (slug, name, kind, description, price_cents, credits, billing_interval, sort_order)
VALUES
  ('bronze', 'Bronze', 'subscription', '4 credits per month', 24000, 4, 'month', 10),
  ('gold', 'Gold', 'subscription', '10 credits per month', 56000, 10, 'month', 20),
  ('diamond', 'Diamond', 'subscription', '25 credits per month', 150000, 25, 'month', 30),
  ('studio-rental', 'Studio rental (2hr)', 'a_la_carte', 'Studio rental block', 7500, 0, NULL, 100),
  ('audio-recording', 'Audio recording (2hr)', 'a_la_carte', 'In-studio recording session', 15000, 0, NULL, 110),
  ('mixing', 'Mixing (2hr)', 'a_la_carte', 'Track mixing session', 15000, 0, NULL, 120),
  ('mastering', 'Mastering', 'a_la_carte', 'Mastering per track', 15000, 0, NULL, 130),
  ('mv-edit', 'Music video edit', 'a_la_carte', 'Music video edit deliverable', 15000, 0, NULL, 140),
  ('photo-shoot', 'Photo shoot (1hr)', 'a_la_carte', 'Photography session', 15000, 0, NULL, 150),
  ('podcast', 'Podcast recording', 'a_la_carte', 'Podcast recording session', 22500, 0, NULL, 160),
  ('design', 'Design (1hr)', 'a_la_carte', 'Design work, hourly', 7500, 0, NULL, 170),
  ('consult', 'Strategy consult (1hr)', 'a_la_carte', 'Roadmap or branding consult', 7500, 0, NULL, 180)
ON CONFLICT (slug) DO NOTHING;
