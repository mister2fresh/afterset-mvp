-- Add 'sending' status to prevent double-pickup by pg_cron
ALTER TYPE email_status ADD VALUE IF NOT EXISTS 'sending' AFTER 'pending';

-- RPC to increment retry_count and reset status to 'pending' for failed batch sends
CREATE OR REPLACE FUNCTION increment_retry_count(pending_ids uuid[])
RETURNS void AS $$
BEGIN
  UPDATE pending_emails
  SET retry_count = retry_count + 1,
      status = CASE
        WHEN retry_count + 1 >= 3 THEN 'failed'::email_status
        ELSE 'pending'::email_status
      END,
      updated_at = now()
  WHERE id = ANY(pending_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
