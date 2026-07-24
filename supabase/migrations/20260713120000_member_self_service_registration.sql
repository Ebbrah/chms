-- Member self-service profile edits and two-tier registration (no offering number path).

-- Members may update their own row (field locks enforced in server actions).
CREATE POLICY members_update_self ON public.members
FOR UPDATE
USING (
  org_id = public.current_org_id()
  AND user_id = auth.uid()
)
WITH CHECK (
  org_id = public.current_org_id()
  AND user_id = auth.uid()
);

-- Members completing onboarding may insert their own pending row (no offering number yet).
CREATE POLICY members_insert_self ON public.members
FOR INSERT
WITH CHECK (
  org_id = public.current_org_id()
  AND user_id = auth.uid()
  AND offering_number IS NULL
  AND status = 'pending_offering_number'
);

-- Next offering number: max numeric value in org + 1 (preserves zero-padding width when uniform).
CREATE OR REPLACE FUNCTION public.next_offering_number_for_org(_org_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_num bigint := 0;
  pad_len int := 0;
  r record;
  digits text;
  n bigint;
BEGIN
  FOR r IN
    SELECT offering_number
    FROM public.members
    WHERE org_id = _org_id
      AND offering_number IS NOT NULL
      AND btrim(offering_number) <> ''
  LOOP
    digits := regexp_replace(btrim(r.offering_number), '[^0-9]', '', 'g');
    IF digits = '' THEN
      CONTINUE;
    END IF;
    n := digits::bigint;
    IF n > max_num THEN
      max_num := n;
      pad_len := length(digits);
    END IF;
  END LOOP;

  IF max_num = 0 THEN
    RETURN '1';
  END IF;

  IF pad_len > 0 THEN
    RETURN lpad((max_num + 1)::text, pad_len, '0');
  END IF;

  RETURN (max_num + 1)::text;
END;
$$;

REVOKE ALL ON FUNCTION public.next_offering_number_for_org (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_offering_number_for_org (uuid) TO authenticated, service_role;

-- Parish admin/treasurer approves a pending registration and assigns the next offering number.
CREATE OR REPLACE FUNCTION public.approve_pending_member_registration(_member_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org uuid;
  uid uuid;
  new_num text;
BEGIN
  IF NOT public.user_has_any_role(ARRAY['admin', 'treasurer']::public.app_role[]) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT m.org_id, m.user_id
  INTO org, uid
  FROM public.members m
  WHERE m.id = _member_id
    AND m.org_id = public.current_org_id()
    AND m.status = 'pending_offering_number'
    AND m.offering_number IS NULL
  FOR UPDATE;

  IF org IS NULL THEN
    RAISE EXCEPTION 'Pending registration not found';
  END IF;

  new_num := public.next_offering_number_for_org(org);

  UPDATE public.members
  SET
    offering_number = new_num,
    status = 'active',
    updated_at = now()
  WHERE id = _member_id;

  -- Link any offerings recorded against this number before approval.
  UPDATE public.offerings o
  SET member_id = _member_id
  WHERE o.org_id = org
    AND o.member_id IS NULL
    AND lower(btrim(COALESCE(o.offering_number_snapshot, ''))) = lower(new_num);

  RETURN new_num;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_pending_member_registration (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_pending_member_registration (uuid) TO authenticated, service_role;

-- Signup: with offering number links seed data; without offering number defers member row to onboarding.
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

  IF seed.id IS NULL AND phone IS NOT NULL THEN
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
