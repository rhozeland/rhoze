CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS fingerprint text, ADD COLUMN IF NOT EXISTS fingerprinted_at timestamptz, ADD COLUMN IF NOT EXISTS chain_signature text;
CREATE OR REPLACE FUNCTION public.rz_release_fingerprint() RETURNS trigger LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD.status IS DISTINCT FROM 'published' OR NEW.fingerprint IS NULL) THEN
    NEW.fingerprinted_at := now();
    NEW.chain_signature := NULL;
    NEW.fingerprint := encode(extensions.digest(convert_to(jsonb_build_object('protocol','rhozeland','v',1,'id',NEW.id,'slug',NEW.slug,'title',NEW.title,'creator',NEW.creator_name,'owner',NEW.user_id,'answers',NEW.answers,'budget_cents',NEW.budget_cents,'coin_mint',NEW.coin_mint,'published_at',NEW.published_at,'ts',NEW.fingerprinted_at)::text,'UTF8'),'sha256'),'hex');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rz_release_fingerprint ON public.releases;
CREATE TRIGGER rz_release_fingerprint BEFORE UPDATE OF status, published_at ON public.releases FOR EACH ROW EXECUTE FUNCTION public.rz_release_fingerprint();
UPDATE public.releases SET published_at = published_at WHERE status='published' AND fingerprint IS NULL;