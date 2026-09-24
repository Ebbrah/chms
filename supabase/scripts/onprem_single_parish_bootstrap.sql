-- Run once on a NEW on-prem database after migrations (Supabase SQL editor or psql).
-- Renames the default single org created by migrations — does not touch cloud production.

-- 1) Set parish identity (edit values for KLCERP before running)
UPDATE public.organizations
SET
  name = 'Kanisa la KLC',
  display_name = 'Kanisa la KLC',
  slug = 'klc',
  timezone = 'Africa/Dar_es_Salaam'
WHERE id = '00000000-0000-4000-8000-000000000001';

UPDATE public.org_certificate_settings
SET
  church_name = 'Kanisa la KLC',
  diocese_name = 'Dayosisi ya Dodoma',
  postal_box = COALESCE(postal_box, 'P.O.Box')
WHERE org_id = '00000000-0000-4000-8000-000000000001';

-- 2) Optional: hide platform UI by not adding anyone to platform_admins.
-- First parish admin: sign up via /join/klc (or your slug), then promote in SQL:
--
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT p.id, 'pastor'::public.app_role
-- FROM public.profiles p
-- WHERE lower(p.email) = lower('admin@klc.example')
-- ON CONFLICT DO NOTHING;
