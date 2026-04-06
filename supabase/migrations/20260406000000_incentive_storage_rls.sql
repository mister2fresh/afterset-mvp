-- Defense-in-depth: restrict direct client access to incentives bucket.
-- Uploads and downloads already go through API-generated signed URLs (service_role),
-- but these policies prevent rogue client-side access via the anon key.

-- Storage path convention: {artist_id}/{page_id}/{filename}

CREATE POLICY "artists_own_incentives_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'incentives'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "artists_own_incentives_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'incentives'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "artists_own_incentives_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'incentives'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
