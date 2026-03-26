-- Link pending_emails to capture_events instead of fan_captures for dedup.
-- This allows returning fans to receive emails on each new capture (per-show).

-- Add capture_event_id column
ALTER TABLE pending_emails
  ADD COLUMN capture_event_id uuid REFERENCES capture_events(id) ON DELETE CASCADE;

-- Backfill existing rows: pick the most recent capture_event per fan_capture_id
UPDATE pending_emails pe
SET capture_event_id = (
  SELECT ce.id FROM capture_events ce
  WHERE ce.fan_capture_id = pe.fan_capture_id
  ORDER BY ce.captured_at DESC
  LIMIT 1
);

-- Drop the old dedup constraint (fan_capture_id + email_template_id)
ALTER TABLE pending_emails
  DROP CONSTRAINT pending_emails_fan_template_unique;

-- New dedup: one email per capture event per template
ALTER TABLE pending_emails
  ADD CONSTRAINT pending_emails_event_template_unique
  UNIQUE (capture_event_id, email_template_id);

-- Index for lookups
CREATE INDEX idx_pending_emails_event ON pending_emails(capture_event_id);
