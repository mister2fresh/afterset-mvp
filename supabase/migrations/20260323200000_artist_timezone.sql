-- Add timezone to artists for correct "next morning" email scheduling
ALTER TABLE artists ADD COLUMN timezone text NOT NULL DEFAULT 'America/New_York';
