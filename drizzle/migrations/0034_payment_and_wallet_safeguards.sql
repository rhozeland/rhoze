-- Legacy instant-credit purchase: no trusted payment proof, so clients may no longer call it.
REVOKE EXECUTE ON FUNCTION public.purchase_rhoze_square(bigint, smallint, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_rhoze_square(bigint, smallint, text, text, text) TO service_role;
COMMENT ON FUNCTION public.purchase_rhoze_square(bigint, smallint, text, text, text) IS 'DEPRECATED: credited on client input. Use create_investor_pledge (pending) + admin_fulfill_investor_pledge.';

-- Wallet addresses can only be set by the signed-proof backend function (or admins); owners may clear theirs.
CREATE OR REPLACE FUNCTION public.guard_profile_wallet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.solana_wallet IS DISTINCT FROM OLD.solana_wallet
     AND NEW.solana_wallet IS NOT NULL
     AND coalesce(auth.role(), '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Wallet changes need a signed proof of ownership';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_profile_wallet ON public.profiles;
CREATE TRIGGER guard_profile_wallet BEFORE UPDATE OF solana_wallet ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_wallet();