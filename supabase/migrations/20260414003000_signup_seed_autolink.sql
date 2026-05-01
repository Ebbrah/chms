-- Auto-link imported seed data on signup (if offering number or phone was provided).
-- Updates handle_new_user to create a member record prefilled from member_seeds.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org uuid := '00000000-0000-4000-8000-000000000001';
  disp text;
  seed record;
  offno text;
  phone text;
BEGIN
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

  -- Prefill members row if there is a matching seed.
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

