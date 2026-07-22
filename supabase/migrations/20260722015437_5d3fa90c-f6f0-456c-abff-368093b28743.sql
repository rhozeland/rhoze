
ALTER TABLE public.milestone_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE POLICY "Author or admin edits milestone messages"
ON public.milestone_messages FOR UPDATE
TO authenticated
USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
