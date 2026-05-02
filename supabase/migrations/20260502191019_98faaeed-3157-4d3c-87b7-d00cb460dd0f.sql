CREATE OR REPLACE FUNCTION public.create_project_from_intake(_intake_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _intake public.intake_requests%ROWTYPE;
  _project_id uuid;
  _code text;
BEGIN
  SELECT * INTO _intake FROM public.intake_requests WHERE id = _intake_id;
  IF _intake IS NULL THEN RAISE EXCEPTION 'intake not found'; END IF;
  IF _intake.project_id IS NOT NULL THEN RETURN _intake.project_id; END IF;

  _code := 'RHZ-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4))
        || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));

  INSERT INTO public.projects (
    title, client_name, client_email, client_phone, status,
    dollar_balance_cents, intake_estimate_cents, project_code, notes
  ) VALUES (
    'Project for ' || _intake.contact_name,
    _intake.contact_name, _intake.contact_email, _intake.contact_phone,
    'active', _intake.deposit_cents, COALESCE(_intake.total_cents, _intake.deposit_cents),
    _code, _intake.message
  ) RETURNING id INTO _project_id;

  UPDATE public.intake_requests
     SET project_id = _project_id,
         status = 'converted',
         paid_at = now()
   WHERE id = _intake_id;

  RETURN _project_id;
END;
$function$;