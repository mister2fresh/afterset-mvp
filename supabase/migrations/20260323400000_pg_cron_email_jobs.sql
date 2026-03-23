-- pg_cron + pg_net jobs for delayed email sending
-- Prerequisites: pg_cron and pg_net extensions must be enabled in Supabase dashboard
--
-- These jobs call the Railway API's /api/emails/send-batch endpoint.
-- Replace RAILWAY_API_URL and BATCH_SEND_SECRET with actual values before running.

-- Job 1: Poll pending emails every 60 seconds and send them
SELECT cron.schedule(
  'send-pending-emails',
  '* * * * *',  -- every minute
  $$
  SELECT net.http_post(
    url := 'RAILWAY_API_URL/api/emails/send-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Batch-Secret', 'BATCH_SEND_SECRET'
    ),
    body := '{}'::jsonb
  ) WHERE EXISTS (
    SELECT 1 FROM pending_emails
    WHERE status = 'pending' AND send_at <= now()
    LIMIT 1
  );
  $$
);

-- Job 2: Retry failed emails every 5 minutes (up to 3 attempts, handled by increment_retry_count RPC)
SELECT cron.schedule(
  'retry-failed-emails',
  '*/5 * * * *',  -- every 5 minutes
  $$
  UPDATE pending_emails
  SET status = 'pending', updated_at = now()
  WHERE status = 'failed'
    AND retry_count < 3
    AND updated_at < now() - interval '5 minutes';
  $$
);
