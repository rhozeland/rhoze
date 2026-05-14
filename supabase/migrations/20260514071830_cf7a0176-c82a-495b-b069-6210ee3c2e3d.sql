-- Allow document creators to delete their own docs
CREATE POLICY "Creators can delete own docs"
ON public.docs
FOR DELETE
TO authenticated
USING (created_by = auth.uid());