-- Add onboarding tracking to artists
ALTER TABLE artists ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
