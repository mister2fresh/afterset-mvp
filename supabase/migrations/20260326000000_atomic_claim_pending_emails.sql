-- Atomic claim function: selects AND marks pending emails as 'sending' in one step.
-- Prevents race conditions when concurrent pg_cron invocations overlap.
CREATE OR REPLACE FUNCTION claim_pending_emails(batch_limit integer DEFAULT 50)
RETURNS SETOF pending_emails AS $$
BEGIN
  RETURN QUERY
  UPDATE pending_emails
  SET status = 'sending', updated_at = now()
  WHERE id IN (
    SELECT id FROM pending_emails
    WHERE status = 'pending' AND send_at <= now()
    ORDER BY send_at ASC
    LIMIT batch_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
