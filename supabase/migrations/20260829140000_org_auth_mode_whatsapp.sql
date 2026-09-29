-- Per-parish authentication mode (email / whatsapp / both) and WhatsApp OTP challenges.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_auth_mode') THEN
    CREATE TYPE public.org_auth_mode AS ENUM ('email', 'whatsapp', 'both');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.org_auth_mode_from_settings(_settings jsonb)
RETURNS public.org_auth_mode
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(COALESCE(_settings ->> 'auth_mode', 'email')))
    WHEN 'whatsapp' THEN 'whatsapp'::public.org_auth_mode
    WHEN 'both' THEN 'both'::public.org_auth_mode
    ELSE 'email'::public.org_auth_mode
  END
$$;

CREATE OR REPLACE FUNCTION public.get_parish_public_by_slug(_slug text)
RETURNS TABLE (
  id uuid,
  display_name text,
  slug text,
  logo_url text,
  status public.org_status,
  auth_mode public.org_auth_mode
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.display_name,
    o.slug,
    o.logo_url,
    o.status,
    public.org_auth_mode_from_settings(o.settings) AS auth_mode
  FROM public.organizations o
  WHERE o.slug = lower(trim(_slug))
    AND o.status = 'active'::public.org_status
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_parish_public_by_slug (text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_parish_public_by_slug (text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_org_auth_mode(_org_id uuid, _mode public.org_auth_mode)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.current_user_platform_admin()
    OR (
      public.user_has_any_role(ARRAY['admin']::public.app_role[])
      AND _org_id = public.current_org_id()
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.organizations o
  SET settings = jsonb_set(
    COALESCE(o.settings, '{}'::jsonb),
    '{auth_mode}',
    to_jsonb(_mode::text),
    true
  )
  WHERE o.id = _org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_org_auth_mode (uuid, public.org_auth_mode) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_org_auth_mode (uuid, public.org_auth_mode) TO authenticated, service_role;

-- OTP storage (server / service role only; no client access).
CREATE TABLE IF NOT EXISTS public.auth_phone_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  parish_slug text NOT NULL,
  phone_e164 text NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('login', 'signup')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts smallint NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_phone_otp_phone_org
ON public.auth_phone_otp_challenges (org_id, phone_e164, created_at DESC);

ALTER TABLE public.auth_phone_otp_challenges ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.normalize_phone_e164(_raw text, _default_country text DEFAULT '255')
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text;
  cc text;
BEGIN
  digits := regexp_replace(COALESCE(_raw, ''), '[^0-9+]', '', 'g');
  digits := regexp_replace(digits, '^\+', '');
  cc := regexp_replace(COALESCE(_default_country, '255'), '[^0-9]', '', 'g');
  IF digits = '' THEN
    RETURN NULL;
  END IF;
  IF digits LIKE cc || '%' AND length(digits) >= 11 THEN
    RETURN '+' || digits;
  END IF;
  IF digits LIKE '0%' THEN
    digits := cc || substring(digits FROM 2);
  ELSIF length(digits) <= 10 THEN
    digits := cc || digits;
  END IF;
  RETURN '+' || digits;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_profile_id_by_phone_in_org(_org_id uuid, _phone_e164 text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.org_id = _org_id
    AND public.normalize_phone_e164(p.phone) = _phone_e164
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.find_profile_id_by_phone_in_org (uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_profile_id_by_phone_in_org (uuid, text) TO service_role;

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
  profile_email text;
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

  phone := NULLIF(
    BTRIM(
      COALESCE(
        NEW.raw_user_meta_data ->> 'phone',
        NEW.phone,
        ''
      )
    ),
    ''
  );
  phone := public.normalize_phone_e164(phone);

  profile_email := NULLIF(BTRIM(COALESCE(NEW.email, NEW.raw_user_meta_data ->> 'contact_email', '')), '');

  disp := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(COALESCE(profile_email, ''), '@', 1),
    'Member'
  );
  offno := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data ->> 'offering_number', '')), '');

  INSERT INTO public.profiles (id, org_id, full_name, email, phone)
  VALUES (NEW.id, org, disp, profile_email, phone)
  ON CONFLICT (id) DO UPDATE
    SET org_id = EXCLUDED.org_id,
        full_name = EXCLUDED.full_name,
        email = COALESCE(public.profiles.email, EXCLUDED.email),
        phone = COALESCE(public.profiles.phone, EXCLUDED.phone);

  INSERT INTO public.user_roles (user_id, org_id, role)
  VALUES (NEW.id, org, 'member')
  ON CONFLICT DO NOTHING;

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
      profile_email,
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
