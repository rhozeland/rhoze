-- 1. Per-person payroll setup (admin-managed)
CREATE TABLE public.payroll_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_type text NOT NULL DEFAULT 'contractor',
  province text NOT NULL DEFAULT 'ON',
  pay_frequency integer NOT NULL DEFAULT 26,
  td1_federal_cents bigint NOT NULL DEFAULT 0,
  td1_provincial_cents bigint NOT NULL DEFAULT 0,
  cpp_exempt boolean NOT NULL DEFAULT false,
  ei_exempt boolean NOT NULL DEFAULT false,
  extra_tax_cents bigint NOT NULL DEFAULT 0,
  vacation_pay_pct numeric NOT NULL DEFAULT 0,
  sin_last4 text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_profiles_worker_type_chk CHECK (worker_type IN ('employee','contractor')),
  CONSTRAINT payroll_profiles_freq_chk CHECK (pay_frequency IN (12,24,26,52))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_profiles TO authenticated;
GRANT ALL ON public.payroll_profiles TO service_role;
ALTER TABLE public.payroll_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payroll profiles readable by self or admin"
  ON public.payroll_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert payroll profiles"
  ON public.payroll_profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update payroll profiles"
  ON public.payroll_profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete payroll profiles"
  ON public.payroll_profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER payroll_profiles_updated_at
  BEFORE UPDATE ON public.payroll_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Yearly statutory constants (admin-editable so rates can be refreshed each year)
CREATE TABLE public.payroll_tax_years (
  year integer PRIMARY KEY,
  config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_tax_years TO authenticated;
GRANT ALL ON public.payroll_tax_years TO service_role;
ALTER TABLE public.payroll_tax_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tax years readable by team"
  ON public.payroll_tax_years FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid()));
CREATE POLICY "Admins manage tax years"
  ON public.payroll_tax_years FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER payroll_tax_years_updated_at
  BEFORE UPDATE ON public.payroll_tax_years
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Deduction fields on pay stubs
ALTER TABLE public.pay_stubs
  ADD COLUMN IF NOT EXISTS gross_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vacation_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpp_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpp2_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ei_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fed_tax_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prov_tax_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deductions_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS employer_cpp_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS employer_ei_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS worker_type text NOT NULL DEFAULT 'contractor',
  ADD COLUMN IF NOT EXISTS province text NOT NULL DEFAULT 'ON',
  ADD COLUMN IF NOT EXISTS pay_frequency integer NOT NULL DEFAULT 26,
  ADD COLUMN IF NOT EXISTS ytd jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Seed 2026 statutory figures (admins can edit later)
INSERT INTO public.payroll_tax_years (year, config) VALUES (2026, '{
  "cpp": { "rate": 0.0595, "max_pensionable": 74600, "basic_exemption": 3500, "rate2": 0.04, "max_pensionable2": 85000 },
  "ei":  { "rate": 0.0163, "max_insurable": 68500, "employer_multiplier": 1.4 },
  "federal": {
    "brackets": [
      { "up_to": 58375,  "rate": 0.145 },
      { "up_to": 116750, "rate": 0.205 },
      { "up_to": 180999, "rate": 0.26 },
      { "up_to": 258000, "rate": 0.29 },
      { "up_to": null,   "rate": 0.33 }
    ],
    "basic_personal": 16800, "lowest_rate": 0.145
  },
  "provincial": {
    "ON": { "brackets": [
      { "up_to": 53800,  "rate": 0.0505 },
      { "up_to": 107600, "rate": 0.0915 },
      { "up_to": 150000, "rate": 0.1116 },
      { "up_to": 220000, "rate": 0.1216 },
      { "up_to": null,   "rate": 0.1316 }
    ], "basic_personal": 12900, "lowest_rate": 0.0505,
      "surtax": [ { "over": 5710, "rate": 0.20 }, { "over": 7307, "rate": 0.36 } ] },
    "BC": { "brackets": [
      { "up_to": 50000,  "rate": 0.0506 },
      { "up_to": 100000, "rate": 0.077 },
      { "up_to": 115000, "rate": 0.105 },
      { "up_to": 140000, "rate": 0.1229 },
      { "up_to": null,   "rate": 0.147 }
    ], "basic_personal": 12930, "lowest_rate": 0.0506 },
    "AB": { "brackets": [
      { "up_to": 60000,  "rate": 0.08 },
      { "up_to": 151234, "rate": 0.10 },
      { "up_to": null,   "rate": 0.12 }
    ], "basic_personal": 22323, "lowest_rate": 0.08 },
    "QC": { "brackets": [
      { "up_to": 54000,  "rate": 0.14 },
      { "up_to": 108000, "rate": 0.19 },
      { "up_to": 132000, "rate": 0.24 },
      { "up_to": null,   "rate": 0.2575 }
    ], "basic_personal": 18571, "lowest_rate": 0.14 }
  }
}'::jsonb);