
CREATE TABLE public.copilot_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_token TEXT,
  brief_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended_pathway TEXT,
  estimate_low_cents INTEGER,
  estimate_high_cents INTEGER,
  timeline_weeks_low INTEGER,
  timeline_weeks_high INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_intake_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT copilot_owner_present CHECK (user_id IS NOT NULL OR guest_token IS NOT NULL)
);
CREATE INDEX copilot_conversations_user_idx ON public.copilot_conversations(user_id);
CREATE INDEX copilot_conversations_guest_idx ON public.copilot_conversations(guest_token);

GRANT SELECT, INSERT, UPDATE ON public.copilot_conversations TO anon;
GRANT SELECT, INSERT, UPDATE ON public.copilot_conversations TO authenticated;
GRANT ALL ON public.copilot_conversations TO service_role;

ALTER TABLE public.copilot_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own conversations"
  ON public.copilot_conversations FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (guest_token IS NOT NULL)
  );

CREATE POLICY "Anyone can create a conversation"
  ON public.copilot_conversations FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND user_id IS NULL AND guest_token IS NOT NULL)
  );

CREATE POLICY "Owners update own conversations"
  ON public.copilot_conversations FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (guest_token IS NOT NULL)
  );

CREATE POLICY "Team reads submitted conversations"
  ON public.copilot_conversations FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()) AND status = 'submitted');

CREATE TABLE public.copilot_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.copilot_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL DEFAULT '',
  attachments_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  transcript_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX copilot_messages_convo_idx ON public.copilot_messages(conversation_id, created_at);

GRANT SELECT, INSERT ON public.copilot_messages TO anon;
GRANT SELECT, INSERT ON public.copilot_messages TO authenticated;
GRANT ALL ON public.copilot_messages TO service_role;

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read messages if convo readable"
  ON public.copilot_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.copilot_conversations c
    WHERE c.id = conversation_id
      AND ((auth.uid() IS NOT NULL AND c.user_id = auth.uid())
        OR c.guest_token IS NOT NULL
        OR (public.is_team_member(auth.uid()) AND c.status = 'submitted'))
  ));

CREATE POLICY "Insert messages if convo writable"
  ON public.copilot_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.copilot_conversations c
    WHERE c.id = conversation_id
      AND ((auth.uid() IS NOT NULL AND c.user_id = auth.uid())
        OR c.guest_token IS NOT NULL)
  ));

CREATE TRIGGER copilot_conversations_updated_at
  BEFORE UPDATE ON public.copilot_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Copilot attachments upload"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'copilot-attachments');

CREATE POLICY "Copilot attachments read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'copilot-attachments');
