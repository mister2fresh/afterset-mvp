-- Auto-purge stuck pending_emails rows whose skip_reason has decayed past usefulness.
-- Different reasons get different TTLs: stale rows were already past the 7-day send
-- window, so we reap them first. email_cap / tier_locked / no_plan rows might still
-- resume sending if the artist upgrades, so they get a longer 30-day window before
-- we give up.
--
-- Runs hourly; this matches the cadence of other housekeeping jobs (see
-- 20260323400000_pg_cron_email_jobs.sql) without flooding logs.

SELECT cron.schedule(
  'purge-paused-emails',
  '17 * * * *',  -- hourly at :17 to stagger from send/retry jobs
  $$
  DELETE FROM pending_emails
  WHERE status = 'pending'
    AND skip_reason_at IS NOT NULL
    AND (
      (skip_reason = 'stale' AND skip_reason_at < now() - interval '14 days')
      OR
      (skip_reason IN ('email_cap', 'tier_locked', 'no_plan')
        AND skip_reason_at < now() - interval '30 days')
    );
  $$
);
