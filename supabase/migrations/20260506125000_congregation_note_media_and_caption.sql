-- Add poster/flier support for congregation notes.

ALTER TABLE public.congregation_notes
ADD COLUMN IF NOT EXISTS image_path text,
ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('congregation-note-media', 'congregation-note-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS congregation_note_media_select ON storage.objects;
CREATE POLICY congregation_note_media_select ON storage.objects
FOR SELECT
USING (bucket_id = 'congregation-note-media');

DROP POLICY IF EXISTS congregation_note_media_insert ON storage.objects;
CREATE POLICY congregation_note_media_insert ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'congregation-note-media');

DROP POLICY IF EXISTS congregation_note_media_update ON storage.objects;
CREATE POLICY congregation_note_media_update ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'congregation-note-media')
WITH CHECK (bucket_id = 'congregation-note-media');

DROP POLICY IF EXISTS congregation_note_media_delete ON storage.objects;
CREATE POLICY congregation_note_media_delete ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'congregation-note-media');
