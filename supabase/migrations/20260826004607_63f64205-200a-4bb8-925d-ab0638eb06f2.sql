
-- 1. Lock down copilot conversations/messages to real owners
DROP POLICY IF EXISTS "Owners read own conversations" ON public.copilot_conversations;
DROP POLICY IF EXISTS "Owners update own conversations" ON public.copilot_conversations;
DROP POLICY IF EXISTS "Anyone can create a conversation" ON public.copilot_conversations;
DROP POLICY IF EXISTS "Read messages if convo readable" ON public.copilot_messages;
DROP POLICY IF EXISTS "Insert messages if convo writable" ON public.copilot_messages;

CREATE POLICY "Signed-in owners read own conversations"
ON public.copilot_conversations FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Signed-in owners update own conversations"
ON public.copilot_conversations FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Signed-in users create own conversations"
ON public.copilot_conversations FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners read own messages"
ON public.copilot_messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.copilot_conversations c
  WHERE c.id = copilot_messages.conversation_id
    AND (c.user_id = auth.uid() OR (public.is_team_member(auth.uid()) AND c.status = 'submitted'))
));

CREATE POLICY "Owners insert own messages"
ON public.copilot_messages FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.copilot_conversations c
  WHERE c.id = copilot_messages.conversation_id AND c.user_id = auth.uid()
));

-- 2. Guest access goes through token-verified security definer RPCs
CREATE OR REPLACE FUNCTION public.copilot_guest_token_ok(p_token text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT p_token IS NOT NULL AND length(p_token) >= 32;
$$;

CREATE OR REPLACE FUNCTION public.copilot_get_conversation(p_id uuid, p_guest_token text)
RETURNS SETOF public.copilot_conversations
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.* FROM public.copilot_conversations c
  WHERE c.id = p_id
    AND (
      (auth.uid() IS NOT NULL AND c.user_id = auth.uid())
      OR (public.copilot_guest_token_ok(p_guest_token) AND c.guest_token = p_guest_token)
    );
$$;

CREATE OR REPLACE FUNCTION public.copilot_find_draft(p_guest_token text)
RETURNS SETOF public.copilot_conversations
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.* FROM public.copilot_conversations c
  WHERE c.status = 'draft'
    AND (
      (auth.uid() IS NOT NULL AND c.user_id = auth.uid())
      OR (auth.uid() IS NULL AND public.copilot_guest_token_ok(p_guest_token) AND c.guest_token = p_guest_token)
    )
  ORDER BY c.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.copilot_create_conversation(p_guest_token text)
RETURNS SETOF public.copilot_conversations
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.copilot_guest_token_ok(p_guest_token) THEN
    RAISE EXCEPTION 'invalid guest token';
  END IF;
  RETURN QUERY
  INSERT INTO public.copilot_conversations (user_id, guest_token)
  VALUES (auth.uid(), p_guest_token)
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.copilot_list_messages(p_conversation_id uuid, p_guest_token text)
RETURNS TABLE (id uuid, role text, content text, transcript_source text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.role::text, m.content, m.transcript_source::text, m.created_at
  FROM public.copilot_messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.role IN ('user','assistant')
    AND EXISTS (
      SELECT 1 FROM public.copilot_conversations c
      WHERE c.id = p_conversation_id
        AND (
          (auth.uid() IS NOT NULL AND c.user_id = auth.uid())
          OR (public.copilot_guest_token_ok(p_guest_token) AND c.guest_token = p_guest_token)
          OR (public.is_team_member(auth.uid()) AND c.status = 'submitted')
        )
    )
  ORDER BY m.created_at;
$$;

CREATE OR REPLACE FUNCTION public.copilot_capture_email(p_conversation_id uuid, p_guest_token text, p_seed text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.copilot_conversations c
    WHERE c.id = p_conversation_id
      AND (
        (auth.uid() IS NOT NULL AND c.user_id = auth.uid())
        OR (public.copilot_guest_token_ok(p_guest_token) AND c.guest_token = p_guest_token)
      )
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.copilot_conversations
    SET email_captured_at = now()
    WHERE id = p_conversation_id;

  IF p_seed IS NOT NULL AND length(btrim(p_seed)) > 0 THEN
    INSERT INTO public.copilot_messages (conversation_id, role, content)
    VALUES (p_conversation_id, 'user', left(p_seed, 5000));
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.copilot_get_conversation(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copilot_find_draft(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copilot_create_conversation(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copilot_list_messages(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copilot_capture_email(uuid, text, text) TO anon, authenticated;

-- 3. Storage: ownership-scoped copilot attachments (path = <conversation_id>/<owner_key>/<file>)
CREATE OR REPLACE FUNCTION public.copilot_attachment_allowed(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.copilot_conversations c
    WHERE c.id::text = (storage.foldername(p_name))[1]
      AND (
        (auth.uid() IS NOT NULL AND c.user_id = auth.uid())
        OR (c.guest_token IS NOT NULL AND c.guest_token = (storage.foldername(p_name))[2])
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.copilot_attachment_allowed(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Copilot attachments read" ON storage.objects;
DROP POLICY IF EXISTS "Copilot attachments upload" ON storage.objects;

CREATE POLICY "Copilot attachments owner read"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'copilot-attachments' AND public.copilot_attachment_allowed(name));

CREATE POLICY "Copilot attachments owner upload"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'copilot-attachments' AND public.copilot_attachment_allowed(name));

-- 4. Stripe price identifiers: no anon/authenticated access at all
REVOKE SELECT (stripe_price_id), INSERT (stripe_price_id), UPDATE (stripe_price_id), REFERENCES (stripe_price_id)
  ON public.service_packages FROM anon, authenticated;
