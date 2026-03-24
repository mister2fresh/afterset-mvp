-- Safe capture page deletion: preserve fan data when pages are deleted
-- 1. Add page_title snapshot to capture_events
-- 2. Make capture_page_id nullable with ON DELETE SET NULL
-- 3. Fix RLS policy to work when capture_page_id is NULL

-- Snapshot the page title at capture time so gig context survives page edits/deletes
ALTER TABLE capture_events ADD COLUMN page_title text;

-- Backfill existing events with current page titles
UPDATE capture_events ce
SET page_title = cp.title
FROM capture_pages cp
WHERE ce.capture_page_id = cp.id;

-- Allow capture_page_id to be NULL (set when page is deleted)
ALTER TABLE capture_events ALTER COLUMN capture_page_id DROP NOT NULL;

-- Replace CASCADE with SET NULL so events survive page deletion
ALTER TABLE capture_events
	DROP CONSTRAINT capture_events_capture_page_id_fkey,
	ADD CONSTRAINT capture_events_capture_page_id_fkey
		FOREIGN KEY (capture_page_id) REFERENCES capture_pages(id) ON DELETE SET NULL;

-- Fix RLS: route through fan_captures → artists instead of capture_pages
-- This handles NULL capture_page_id naturally
CREATE OR REPLACE POLICY "capture_events_select_own" ON capture_events
	FOR SELECT USING (
		fan_capture_id IN (
			SELECT fc.id FROM fan_captures fc
			JOIN artists a ON a.id = fc.artist_id
			WHERE a.auth_id = auth.uid()
		)
	);
