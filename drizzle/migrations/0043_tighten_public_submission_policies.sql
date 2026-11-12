DROP POLICY IF EXISTS "Anyone submits booking" ON public.bookings;
CREATE POLICY "Anyone submits booking" ON public.bookings FOR INSERT TO anon, authenticated
WITH CHECK (
  user_id IS NULL AND release_id IS NULL AND paid_credits = 0
  AND status = 'confirmed'
  AND slot_end > slot_start AND slot_start > now()
  AND length(name) BETWEEN 1 AND 200
  AND length(email) BETWEEN 3 AND 320 AND email LIKE '%@%'
  AND (phone IS NULL OR length(phone) <= 40)
  AND (notes IS NULL OR length(notes) <= 5000)
);

DROP POLICY IF EXISTS "Anyone submits intake" ON public.intake_requests;
CREATE POLICY "Anyone submits intake" ON public.intake_requests FOR INSERT TO anon, authenticated
WITH CHECK (
  status IN ('pending','concierge')
  AND paid_at IS NULL AND stripe_session_id IS NULL AND stripe_payment_intent_id IS NULL
  AND project_id IS NULL AND deposit_cents = 0 AND total_cents = 0
  AND length(contact_name) BETWEEN 1 AND 200
  AND length(contact_email) BETWEEN 3 AND 320 AND contact_email LIKE '%@%'
  AND (contact_phone IS NULL OR length(contact_phone) <= 40)
  AND (message IS NULL OR length(message) <= 10000)
);

DROP POLICY IF EXISTS "Anyone reads rhoze settings" ON public.rhoze_settings;
CREATE POLICY "Anyone reads rhoze settings" ON public.rhoze_settings FOR SELECT TO anon, authenticated
USING (id = 1);

DROP POLICY IF EXISTS "Anyone uploads project covers" ON storage.objects;
CREATE POLICY "Anyone uploads project covers" ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'covers'
  AND (storage.foldername(name))[2] = 'drafts'
  AND lower(name) ~ '\.(jpg|jpeg|png|webp)$'
);

DROP POLICY IF EXISTS "Anyone uploads application attachments" ON storage.objects;
CREATE POLICY "Anyone uploads application attachments" ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'applications'
  AND lower(name) ~ '\.(jpg|jpeg|png|webp|gif|pdf|mp3|wav|mp4|mov)$'
);