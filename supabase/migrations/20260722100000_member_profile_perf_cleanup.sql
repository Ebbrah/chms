-- Profile reads: faster lookup by auth user + org, and remove legacy multi-MB inline photo blobs.

CREATE INDEX IF NOT EXISTS idx_members_user_org_updated
ON public.members (user_id, org_id, updated_at DESC);

UPDATE public.members
SET member_details = member_details - 'passport_photo_data_url'
WHERE member_details ? 'passport_photo_data_url';
