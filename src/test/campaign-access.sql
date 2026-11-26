-- Read-only regression check; both results must be true.
SELECT
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaign_state'
      AND policyname = 'campaign_state public read'
      AND cmd = 'SELECT' AND qual = '(id = 1)'
      AND roles = ARRAY['anon', 'authenticated']::name[]
  ) AS public_reads_only_site_campaign,
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaign_state'
      AND cmd IN ('SELECT', 'ALL')
      AND roles && ARRAY['anon', 'authenticated', 'public']::name[]
      AND qual = 'true'
  ) AS no_blanket_campaign_read;