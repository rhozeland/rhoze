
CREATE TABLE public.milestone_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL REFERENCES public.project_milestones(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX milestone_messages_milestone_idx ON public.milestone_messages(milestone_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.milestone_messages TO authenticated;
GRANT ALL ON public.milestone_messages TO service_role;

ALTER TABLE public.milestone_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team or project client reads milestone messages"
ON public.milestone_messages FOR SELECT
TO authenticated
USING (
  is_team_member(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.project_clients pc
    WHERE pc.project_id = milestone_messages.project_id
      AND pc.user_id = auth.uid()
  )
);

CREATE POLICY "Team or project client posts milestone messages"
ON public.milestone_messages FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    is_team_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_clients pc
      WHERE pc.project_id = milestone_messages.project_id
        AND pc.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Author or admin deletes milestone messages"
ON public.milestone_messages FOR DELETE
TO authenticated
USING (author_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
