-- Sprint 5: pricing tier enforcement foundation.
-- Adds tier + trial columns to artists, historical over-cap marker to fan_captures,
-- and skip-reason tracking to pending_emails. Grandfathers existing artists to superstar
-- and tightens claim_pending_emails() with a 7-day staleness cap so ancient rows
-- don't fire during catch-up runs.

CREATE TYPE tier_level AS ENUM ('solo', 'tour', 'superstar');

ALTER TABLE artists
  ADD COLUMN tier tier_level NOT NULL DEFAULT 'solo',
  ADD COLUMN trial_ends_at timestamptz;

ALTER TABLE fan_captures
  ADD COLUMN cap_exceeded_at timestamptz;

ALTER TABLE pending_emails
  ADD COLUMN skip_reason text,
  ADD COLUMN skip_reason_at timestamptz;

-- Grandfather all existing artists to superstar with no active trial (Decision 1).
UPDATE artists SET tier = 'superstar', trial_ends_at = NULL;

-- Rebuild claim_pending_emails() with the 7-day staleness cap. Rows older than that
-- stay in 'pending' but never get claimed; the send-batch path treats them as
-- skip_reason='stale' once tier gating is wired up in Phase 2.
CREATE OR REPLACE FUNCTION claim_pending_emails(batch_limit integer DEFAULT 50)
RETURNS SETOF pending_emails AS $$
BEGIN
  RETURN QUERY
  UPDATE pending_emails
  SET status = 'sending', updated_at = now()
  WHERE id IN (
    SELECT id FROM pending_emails
    WHERE status = 'pending'
      AND send_at <= now()
      AND send_at > now() - interval '7 days'
    ORDER BY send_at ASC
    LIMIT batch_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
