-- Store member passport photos in Supabase Storage instead of json payloads

INSERT INTO storage.buckets (id, name, public)
VALUES ('member-passports', 'member-passports', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS member_passports_select ON storage.objects;
CREATE POLICY member_passports_select ON storage.objects
FOR SELECT
USING (bucket_id = 'member-passports');

DROP POLICY IF EXISTS member_passports_insert ON storage.objects;
CREATE POLICY member_passports_insert ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'member-passports');

DROP POLICY IF EXISTS member_passports_update ON storage.objects;
CREATE POLICY member_passports_update ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'member-passports')
WITH CHECK (bucket_id = 'member-passports');

DROP POLICY IF EXISTS member_passports_delete ON storage.objects;
CREATE POLICY member_passports_delete ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'member-passports');
