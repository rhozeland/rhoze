CREATE OR REPLACE FUNCTION public.payroll_save_my_setup(
  p_worker_type text, p_province text, p_td1_federal_cents bigint, p_td1_provincial_cents bigint,
  p_extra_tax_cents bigint, p_sin_last4 text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF NOT (public.has_role(uid,'employee') OR public.has_role(uid,'admin')) THEN RAISE EXCEPTION 'Team members only'; END IF;
  IF p_worker_type NOT IN ('employee','contractor') THEN RAISE EXCEPTION 'Pick employee or contractor'; END IF;
  IF p_province NOT IN ('ON','BC','AB','QC') THEN RAISE EXCEPTION 'Pick a province'; END IF;
  IF p_td1_federal_cents < 0 OR p_td1_provincial_cents < 0 OR p_extra_tax_cents < 0
     OR p_td1_federal_cents > 100000000 OR p_td1_provincial_cents > 100000000 OR p_extra_tax_cents > 1000000 THEN
    RAISE EXCEPTION 'Amounts look wrong'; END IF;
  IF p_sin_last4 IS NOT NULL AND p_sin_last4 !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'Enter the last 4 digits only'; END IF;
  INSERT INTO public.payroll_profiles(user_id, worker_type, province, td1_federal_cents, td1_provincial_cents, extra_tax_cents, sin_last4)
  VALUES (uid, p_worker_type, p_province, p_td1_federal_cents, p_td1_provincial_cents, p_extra_tax_cents, p_sin_last4)
  ON CONFLICT (user_id) DO UPDATE SET worker_type=EXCLUDED.worker_type, province=EXCLUDED.province,
    td1_federal_cents=EXCLUDED.td1_federal_cents, td1_provincial_cents=EXCLUDED.td1_provincial_cents,
    extra_tax_cents=EXCLUDED.extra_tax_cents, sin_last4=EXCLUDED.sin_last4, updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.payroll_save_my_setup(text,text,bigint,bigint,bigint,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.payroll_save_my_setup(text,text,bigint,bigint,bigint,text) TO authenticated;