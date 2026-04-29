
REVOKE EXECUTE ON FUNCTION public.validate_referral_code(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.consume_referral_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_referral_code(text) TO authenticated;
