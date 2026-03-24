-- Drip campaigns: allow multiple email templates per capture page (sequential sequences)

-- 1a. Alter email_templates: drop one-per-page constraint, add sequence columns
ALTER TABLE email_templates DROP CONSTRAINT email_templates_one_per_page;
ALTER TABLE email_templates ADD COLUMN sequence_order integer NOT NULL DEFAULT 0;
ALTER TABLE email_templates ADD COLUMN delay_days integer NOT NULL DEFAULT 0;
ALTER TABLE email_templates ADD CONSTRAINT email_templates_page_order UNIQUE(capture_page_id, sequence_order);
ALTER TABLE email_templates ADD CONSTRAINT email_templates_delay_days_range CHECK (delay_days >= 0 AND delay_days <= 30);

-- 1b. Alter pending_emails: link to specific template, dedup constraint
ALTER TABLE pending_emails ADD COLUMN email_template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL;
CREATE INDEX idx_pending_emails_template ON pending_emails(email_template_id);
ALTER TABLE pending_emails ADD CONSTRAINT pending_emails_fan_template_unique UNIQUE(fan_capture_id, email_template_id);

-- 1c. Backfill existing pending_emails with their template ID
UPDATE pending_emails pe
SET email_template_id = et.id
FROM capture_events ce
JOIN email_templates et ON et.capture_page_id = ce.capture_page_id AND et.sequence_order = 0
WHERE pe.fan_capture_id = ce.fan_capture_id
  AND pe.email_template_id IS NULL;
