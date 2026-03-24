-- Track when follow-up emails are opened (via Resend webhook)
ALTER TABLE pending_emails ADD COLUMN opened_at timestamptz;

-- Index for analytics: count opened emails per capture page
CREATE INDEX idx_pending_emails_opened ON pending_emails (artist_id, opened_at)
  WHERE opened_at IS NOT NULL;
