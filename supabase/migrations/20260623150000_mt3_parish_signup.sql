-- MT-Phase 3: Parish-scoped signup via join link; no default-org open signup.

CREATE OR REPLACE FUNCTION public.get_parish_public_by_slug(_slug text)
RETURNS TABLE (
  id uuid,
  display_name text,
  slug text,
  logo_url text,
  status public.org_status
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.display_name, o.slug, o.logo_url, o.status
  FROM public.organizations o
  WHERE o.slug = lower(trim(_slug))
    AND o.status = 'active'::public.org_status
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_parish_public_by_slug (text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_parish_public_by_slug (text) TO anon, authenticated, service_role;

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
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = COALESCE(public.profiles.phone, EXCLUDED.phone);

  INSERT INTO public.user_roles (user_id, org_id, role)
  VALUES (NEW.id, org, 'member')
  ON CONFLICT DO NOTHING;

  IF offno IS NOT NULL THEN
    SELECT *
    INTO seed
    FROM public.member_seeds s
    WHERE s.org_id = org
      AND s.offering_number = offno
    LIMIT 1;
  ELSIF phone IS NOT NULL THEN
    SELECT *
    INTO seed
    FROM public.member_seeds s
    WHERE s.org_id = org
      AND s.phone = phone
    LIMIT 1;
  END IF;

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
      COALESCE(offno, seed.offering_number),
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
