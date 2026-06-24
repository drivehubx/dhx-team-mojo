
-- RLS policies for job-photos bucket: authenticated users can manage photos in their workspace.
-- Path format: {workspaceId}/{jobId}/{uuid}.{ext}
CREATE POLICY "job-photos read for authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'job-photos');

CREATE POLICY "job-photos insert for authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'job-photos');

CREATE POLICY "job-photos update for authenticated"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'job-photos');

CREATE POLICY "job-photos delete for authenticated"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'job-photos');
