-- Migrate pg_cron email jobs from hardcoded placeholders to Supabase Vault secrets.
--
-- Prerequisites (run in SQL Editor or via dashboard BEFORE applying this migration):
--   SELECT vault.create_secret('https://YOUR-RAILWAY-URL', 'railway_api_url');
--   SELECT vault.create_secret('YOUR-BATCH-SEND-SECRET', 'batch_send_secret');

-- Replace the send-pending-emails job to read secrets from Vault at runtime
SELECT cron.unschedule('send-pending-emails');

SELECT cron.schedule(
  'send-pending-emails',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'railway_api_url') || '/api/emails/send-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Batch-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'batch_send_secret')
    ),
    body := '{}'::jsonb
  ) WHERE EXISTS (
    SELECT 1 FROM pending_emails
    WHERE status = 'pending' AND send_at <= now()
    LIMIT 1
  );
  $$
);
