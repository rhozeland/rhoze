CREATE TABLE public.benefit_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  description text,
  employer_cost_cents integer NOT NULL DEFAULT 0,
  employee_cost_cents integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.benefit_plans TO authenticated;
GRANT ALL ON public.benefit_plans TO service_role;
ALTER TABLE public.benefit_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view benefit plans" ON public.benefit_plans
  FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Admins manage benefit plans" ON public.benefit_plans
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.employee_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.benefit_plans(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'enrolled',
  enrolled_on date NOT NULL DEFAULT current_date,
  ended_on date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_benefits TO authenticated;
GRANT ALL ON public.employee_benefits TO service_role;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view their own benefits" ON public.employee_benefits
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage employee benefits" ON public.employee_benefits
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER benefit_plans_updated_at BEFORE UPDATE ON public.benefit_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER employee_benefits_updated_at BEFORE UPDATE ON public.employee_benefits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.benefit_plans (name, category, description, employer_cost_cents, sort_order) VALUES
  ('Health & dental', 'health', 'Extended health and dental coverage', 0, 1),
  ('Gear stipend', 'stipend', 'Annual creative gear allowance', 0, 2),
  ('Paid vacation', 'time_off', 'Accrued paid time off', 0, 3),
  ('$RHOZE allocation', 'equity', 'Token allocation for contributors', 0, 4);
