-- Display name only — org_id unchanged; safe for existing users and data.
UPDATE public.organizations
SET
  name = 'Ebenezer',
  display_name = 'Ebenezer',
  slug = 'ebenezer'
WHERE id = '00000000-0000-4000-8000-000000000001'
  AND (name = 'Default Church' OR slug = 'default-church' OR display_name IS NULL);

UPDATE public.org_certificate_settings
SET church_name = 'Ebenezer'
WHERE org_id = '00000000-0000-4000-8000-000000000001'
  AND (church_name IS NULL OR church_name = 'Default Church');
