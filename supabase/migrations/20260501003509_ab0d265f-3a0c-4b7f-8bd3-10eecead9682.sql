CREATE OR REPLACE FUNCTION public.redeem_project_code(_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Backfill any anonymous subscriptions on this project so the redeeming user
  -- becomes the billing-portal owner.
  UPDATE public.subscriptions
     SET user_id = _uid, updated_at = now()
   WHERE project_id = _project_id
     AND user_id IS NULL;
  -- one-time use: clear the code
  UPDATE public.projects SET project_code = NULL WHERE id = _project_id;
  RETURN _project_id;
END;
$function$;