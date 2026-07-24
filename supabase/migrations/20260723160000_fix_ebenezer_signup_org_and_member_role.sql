-- Fix parish signup for legacy/re-registering users and backfill missing member roles.
-- Ebenezer (default parish) often has pre-existing profiles without a members row or member role.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org uuid;
  disp text;
  seed record;
  offno text;
  phone text;
  parish_slug text;
BEGIN
  parish_slug := lower(trim(COALESCE(NEW.raw_user_meta_data ->> 'parish_slug', '')));

  IF parish_slug = '' OR parish_slug IS NULL THEN
    RAISE EXCEPTION 'Signup requires a parish join link. Ask your parish for their registration URL.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT o.id INTO org
  FROM public.organizations o
  WHERE o.slug = parish_slug
    AND o.status = 'active'::public.org_status;

  IF org IS NULL THEN
    RAISE EXCEPTION 'Invalid or inactive parish join link.'
      USING ERRCODE = 'P0001';
  END IF;

  disp := COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1));
  offno := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data ->> 'offering_number', '')), '');
  phone := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), '');

  INSERT INTO public.profiles (id, org_id, full_name, email, phone)
  VALUES (NEW.id, org, disp, NEW.email, phone)
  ON CONFLICT (id) DO UPDATE
    SET org_id = EXCLUDED.org_id,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = COALESCE(public.profiles.phone, EXCLUDED.phone);

  INSERT INTO public.user_roles (user_id, org_id, role)
  VALUES (NEW.id, org, 'member')
  ON CONFLICT DO NOTHING;

  -- No offering number: member row is created later during complete-registration onboarding.
  IF offno IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO seed
  FROM public.member_seeds s
  WHERE s.org_id = org
    AND s.offering_number = offno
  LIMIT 1;

  IF seed.id IS NOT NULL THEN
    INSERT INTO public.members (
      org_id,
      user_id,
      email,
      phone,
      offering_number,
      status,
      member_details
    )
    VALUES (
      org,
      NEW.id,
      NEW.email,
      COALESCE(phone, seed.phone),
      offno,
      'active',
      jsonb_build_object(
        'full_name', COALESCE(seed.full_name, disp),
        'gender', COALESCE(seed.gender, ''),
        'pledge_1', COALESCE(seed.pledge_ahadi::text, ''),
        'pledge_2', COALESCE(seed.pledge_jengo::text, ''),
        'pledge_3', COALESCE(seed.pledge_dayosisi::text, '')
      ) || COALESCE(seed.raw, '{}'::jsonb)
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Parish profiles missing the member role cannot enter self-service onboarding.
INSERT INTO public.user_roles (user_id, org_id, role)
SELECT p.id, p.org_id, 'member'::public.app_role
FROM public.profiles p
WHERE p.org_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.org_id = p.org_id
      AND ur.role = 'member'::public.app_role
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = p.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.org_id = p.org_id
      AND ur.role IN (
        'admin'::public.app_role,
        'treasurer'::public.app_role,
        'pastor'::public.app_role,
        'assistant_pastor'::public.app_role
      )
  )
ON CONFLICT DO NOTHING;
