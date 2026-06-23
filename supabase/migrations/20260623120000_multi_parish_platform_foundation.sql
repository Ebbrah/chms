-- MT-Phase 1: Multi-parish platform foundation.
-- Additive only: backfills the existing default parish into a diocese/district hierarchy.
-- Does not change handle_new_user() (MT-3) or parish-facing UI (MT-2+).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_status') THEN
    CREATE TYPE public.org_status AS ENUM ('active', 'suspended', 'provisioning');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'diocese_officer_role') THEN
    CREATE TYPE public.diocese_officer_role AS ENUM (
      'diocese_bishop',
      'diocese_general_secretary',
      'diocese_treasurer',
      'diocese_committee_head'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'district_officer_role') THEN
    CREATE TYPE public.district_officer_role AS ENUM (
      'district_head',
      'district_secretary',
      'district_treasurer',
      'district_committee_head'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Hierarchy tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dioceses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  settings jsonb NOT NULL DEFAULT jsonb_build_object(
    'demographic_bands',
    jsonb_build_object('child_max', 12, 'youth_max', 35)
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diocese_id uuid NOT NULL REFERENCES public.dioceses (id) ON DELETE RESTRICT,
  name text NOT NULL,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diocese_id, code)
);

CREATE INDEX IF NOT EXISTS idx_districts_diocese ON public.districts (diocese_id);

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts (id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS slug text,
ADD COLUMN IF NOT EXISTS display_name text,
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
ADD COLUMN IF NOT EXISTS fiscal_year_start_month smallint NOT NULL DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
ADD COLUMN IF NOT EXISTS status public.org_status NOT NULL DEFAULT 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug_unique
ON public.organizations (slug)
WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_district ON public.organizations (district_id);

-- ---------------------------------------------------------------------------
-- Platform & regional officer tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_parish_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_parish_operators_user
ON public.platform_parish_operators (user_id);

CREATE TABLE IF NOT EXISTS public.diocese_officers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diocese_id uuid NOT NULL REFERENCES public.dioceses (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.diocese_officer_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diocese_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_diocese_officers_user ON public.diocese_officers (user_id);

CREATE TABLE IF NOT EXISTS public.district_officers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid NOT NULL REFERENCES public.districts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.district_officer_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (district_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_district_officers_user ON public.district_officers (user_id);

CREATE TABLE IF NOT EXISTS public.parish_membership_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  from_org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  to_org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_org_id <> to_org_id)
);

CREATE INDEX IF NOT EXISTS idx_parish_membership_transfers_user
ON public.parish_membership_transfers (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Backfill default diocese / district / existing parish metadata
-- ---------------------------------------------------------------------------
INSERT INTO public.dioceses (id, name, code, settings)
VALUES (
  '00000000-0000-4000-8000-000000000010',
  'Dayosisi ya Dodoma',
  'dodoma',
  jsonb_build_object(
    'demographic_bands',
    jsonb_build_object('child_max', 12, 'youth_max', 35)
  )
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.districts (id, diocese_id, name, code)
VALUES (
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000010',
  'Jimbo Kuu la Dodoma',
  'dodoma-central'
)
ON CONFLICT (diocese_id, code) DO NOTHING;

UPDATE public.organizations
SET
  district_id = COALESCE(district_id, '00000000-0000-4000-8000-000000000011'::uuid),
  display_name = COALESCE(display_name, name),
  slug = COALESCE(slug, 'default-church'),
  timezone = COALESCE(NULLIF(timezone, ''), 'Africa/Dar_es_Salaam'),
  status = COALESCE(status, 'active'::public.org_status),
  settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
    'features',
    COALESCE(settings -> 'features', '{}'::jsonb) || jsonb_build_object(
      'module_offerings', true,
      'module_finance', true,
      'module_payroll', true,
      'module_travel_certificates', true,
      'module_sms', true,
      'offerings_mpesa', false,
      'member_import', true
    )
  )
WHERE id = '00000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- Role helpers scoped to current parish (org)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_any_role(_roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.org_id = public.current_org_id()
      AND ur.role = ANY (_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_any_role (ARRAY['admin']::public.app_role[])
$$;

CREATE OR REPLACE FUNCTION public.can_finance()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_any_role (ARRAY['admin', 'treasurer']::public.app_role[])
$$;

CREATE OR REPLACE FUNCTION public.can_pastoral()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.user_has_any_role (ARRAY['admin', 'treasurer', 'pastor']::public.app_role[])
    OR public.user_has_role_key ('assistant_pastor')
$$;

CREATE OR REPLACE FUNCTION public.user_is_treasurer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_any_role (ARRAY['treasurer']::public.app_role[])
$$;

-- ---------------------------------------------------------------------------
-- Platform / regional scope helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_platform_parish_operator(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.platform_parish_operators ppo
      WHERE ppo.user_id = auth.uid()
        AND ppo.org_id = _org_id
    )
$$;

CREATE OR REPLACE FUNCTION public.current_user_diocese_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dof.diocese_id
  FROM public.diocese_officers dof
  WHERE dof.user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_district_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dof.district_id
  FROM public.district_officers dof
  WHERE dof.user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.org_has_feature(_org_id uuid, _feature_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (o.settings -> 'features' ->> _feature_key)::boolean
      FROM public.organizations o
      WHERE o.id = _org_id
    ),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.default_org_features()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'module_offerings', true,
    'module_finance', true,
    'module_payroll', true,
    'module_travel_certificates', true,
    'module_sms', true,
    'offerings_mpesa', false,
    'member_import', true
  )
$$;

-- ---------------------------------------------------------------------------
-- Demographics helper for future diocese/district roll-up reports (MT-4)
-- member_details fields: gender, birth_date, marital_status, is_orphan (Ndio/Hapana)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.member_demographic_flags(
  _details jsonb,
  _child_max int DEFAULT 12,
  _youth_max int DEFAULT 35
)
RETURNS TABLE (
  gender_category text,
  is_female boolean,
  is_male boolean,
  is_widow boolean,
  is_widower boolean,
  is_orphan boolean,
  age_years int,
  age_band text
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  gender_raw text;
  marital_raw text;
  orphan_raw text;
  birth_raw text;
  birth_date date;
BEGIN
  gender_raw := lower(trim(COALESCE(_details ->> 'gender', '')));
  marital_raw := trim(COALESCE(_details ->> 'marital_status', ''));
  orphan_raw := trim(COALESCE(_details ->> 'is_orphan', ''));

  is_female := gender_raw IN ('mwanamke', 'female', 'f');
  is_male := gender_raw IN ('mwanamume', 'male', 'm');
  is_widow := marital_raw = 'Mjane';
  is_widower := marital_raw = 'Mgane';
  is_orphan := orphan_raw IN ('Ndio', 'Yes', 'true', '1');

  IF is_female THEN
    gender_category := 'female';
  ELSIF is_male THEN
    gender_category := 'male';
  ELSE
    gender_category := 'unknown';
  END IF;

  birth_raw := NULLIF(trim(COALESCE(_details ->> 'birth_date', '')), '');
  IF birth_raw IS NOT NULL THEN
    BEGIN
      birth_date := birth_raw::date;
      age_years := date_part('year', age(current_date, birth_date))::int;
    EXCEPTION WHEN OTHERS THEN
      age_years := NULL;
    END;
  ELSE
    age_years := NULL;
  END IF;

  IF age_years IS NULL THEN
    age_band := 'unknown';
  ELSIF age_years <= _child_max THEN
    age_band := 'child';
  ELSIF age_years <= _youth_max THEN
    age_band := 'youth';
  ELSE
    age_band := 'adult';
  END IF;

  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Parish provisioning (platform admin only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_parish(
  _district_id uuid,
  _display_name text,
  _slug text,
  _timezone text DEFAULT 'Africa/Dar_es_Salaam',
  _fiscal_label text DEFAULT NULL,
  _fiscal_start date DEFAULT NULL,
  _fiscal_end date DEFAULT NULL,
  _church_name text DEFAULT NULL,
  _diocese_name text DEFAULT NULL,
  _postal_box text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  district_row public.districts%ROWTYPE;
  diocese_row public.dioceses%ROWTYPE;
  fy_label text;
  fy_start date;
  fy_end date;
  cert_church text;
  cert_diocese text;
  cert_postal text;
  normalized_slug text;
BEGIN
  IF NOT public.current_user_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;

  normalized_slug := lower(trim(regexp_replace(_slug, '[^a-z0-9]+', '-', 'gi'), '-'));
  IF normalized_slug = '' OR normalized_slug IS NULL THEN
    RAISE EXCEPTION 'Parish slug is required';
  END IF;

  IF EXISTS (SELECT 1 FROM public.organizations o WHERE o.slug = normalized_slug) THEN
    RAISE EXCEPTION 'Parish slug already exists: %', normalized_slug;
  END IF;

  SELECT * INTO district_row FROM public.districts d WHERE d.id = _district_id;
  IF district_row.id IS NULL THEN
    RAISE EXCEPTION 'District not found';
  END IF;

  SELECT * INTO diocese_row FROM public.dioceses d WHERE d.id = district_row.diocese_id;

  fy_label := COALESCE(
    NULLIF(trim(_fiscal_label), ''),
    'FY ' || date_part('year', current_date)::text
  );
  fy_start := COALESCE(_fiscal_start, date_trunc('year', current_date)::date);
  fy_end := COALESCE(_fiscal_end, (date_trunc('year', current_date) + interval '1 year - 1 day')::date);

  cert_church := COALESCE(NULLIF(trim(_church_name), ''), trim(_display_name));
  cert_diocese := COALESCE(NULLIF(trim(_diocese_name), ''), diocese_row.name);
  cert_postal := COALESCE(NULLIF(trim(_postal_box), ''), 'P.O.Box');

  INSERT INTO public.organizations (
    name,
    display_name,
    slug,
    district_id,
    timezone,
    status,
    settings
  )
  VALUES (
    trim(_display_name),
    trim(_display_name),
    normalized_slug,
    _district_id,
    COALESCE(NULLIF(trim(_timezone), ''), 'Africa/Dar_es_Salaam'),
    'provisioning',
    jsonb_build_object('features', public.default_org_features())
  )
  RETURNING id INTO new_org_id;

  INSERT INTO public.accounts (org_id, code, name, type)
  VALUES
    (new_org_id, '1000', 'Cash on hand', 'asset'),
    (new_org_id, '1100', 'Bank — operating', 'asset'),
    (new_org_id, '2000', 'Accounts payable', 'liability'),
    (new_org_id, '2100', 'Payroll withholdings payable', 'liability'),
    (new_org_id, '3000', 'Net assets', 'equity'),
    (new_org_id, '4000', 'Donations & offerings', 'revenue'),
    (new_org_id, '5000', 'Salary expense', 'expense'),
    (new_org_id, '5100', 'Miscellaneous expense', 'expense')
  ON CONFLICT (org_id, code) DO NOTHING;

  INSERT INTO public.fiscal_years (org_id, label, start_date, end_date)
  VALUES (new_org_id, fy_label, fy_start, fy_end)
  ON CONFLICT (org_id, label) DO NOTHING;

  INSERT INTO public.offering_types (org_id, name)
  SELECT new_org_id, v
  FROM (
    VALUES
      ('Tithe'),
      ('Thanksgiving'),
      ('Ahadi'),
      ('Jengo'),
      ('Maendeleo ya Dayosisi')
  ) AS t(v)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.offering_types ot
    WHERE ot.org_id = new_org_id
      AND ot.name = t.v
  );

  INSERT INTO public.committees (org_id, key, name)
  SELECT new_org_id, v.key, v.name
  FROM (
    VALUES
      ('evangelism', 'Evangelism Committee'),
      ('planning', 'Planning Committee'),
      ('malezi', 'Malezi Committee'),
      ('diaconic', 'Diaconic Committee'),
      ('environmental', 'Environmental Committee')
  ) AS v(key, name)
  ON CONFLICT (org_id, key) DO NOTHING;

  INSERT INTO public.org_certificate_settings (
    org_id,
    church_name,
    diocese_name,
    postal_box
  )
  VALUES (new_org_id, cert_church, cert_diocese, cert_postal)
  ON CONFLICT (org_id) DO NOTHING;

  UPDATE public.organizations
  SET status = 'active'::public.org_status
  WHERE id = new_org_id;

  RETURN new_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_parish (
  uuid,
  text,
  text,
  text,
  text,
  date,
  date,
  text,
  text,
  text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.provision_parish (
  uuid,
  text,
  text,
  text,
  text,
  date,
  date,
  text,
  text,
  text
) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Parish transfer hook (used in MT-3; callable by platform admin now)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_user_to_parish(
  _user_id uuid,
  _to_org_id uuid,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_org uuid;
BEGIN
  IF NOT public.current_user_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;

  SELECT p.org_id INTO from_org
  FROM public.profiles p
  WHERE p.id = _user_id;

  IF from_org IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF from_org = _to_org_id THEN
    RAISE EXCEPTION 'User is already assigned to this parish';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = _to_org_id
      AND o.status = 'active'::public.org_status
  ) THEN
    RAISE EXCEPTION 'Target parish is not active';
  END IF;

  INSERT INTO public.parish_membership_transfers (user_id, from_org_id, to_org_id, actor_id, reason)
  VALUES (_user_id, from_org, _to_org_id, auth.uid(), _reason);

  DELETE FROM public.user_roles ur
  WHERE ur.user_id = _user_id
    AND ur.org_id = from_org;

  UPDATE public.members
  SET status = 'inactive'
  WHERE user_id = _user_id
    AND org_id = from_org;

  UPDATE public.profiles
  SET org_id = _to_org_id
  WHERE id = _user_id;

  INSERT INTO public.user_roles (user_id, org_id, role)
  VALUES (_user_id, _to_org_id, 'member')
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_user_to_parish (uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_user_to_parish (uuid, uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.dioceses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_parish_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diocese_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.district_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parish_membership_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_select_platform ON public.organizations;
CREATE POLICY org_select_platform ON public.organizations
FOR SELECT
USING (public.current_user_platform_admin());

DROP POLICY IF EXISTS dioceses_select ON public.dioceses;
CREATE POLICY dioceses_select ON public.dioceses
FOR SELECT
USING (
  public.current_user_platform_admin()
  OR id = public.current_user_diocese_id()
  OR id IN (
    SELECT dist.diocese_id
    FROM public.districts dist
    JOIN public.organizations o ON o.district_id = dist.id
    WHERE o.id = public.current_org_id()
  )
);

DROP POLICY IF EXISTS dioceses_platform_write ON public.dioceses;
CREATE POLICY dioceses_platform_write ON public.dioceses
FOR ALL
USING (public.current_user_platform_admin())
WITH CHECK (public.current_user_platform_admin());

DROP POLICY IF EXISTS districts_select ON public.districts;
CREATE POLICY districts_select ON public.districts
FOR SELECT
USING (
  public.current_user_platform_admin()
  OR id = public.current_user_district_id()
  OR id IN (
    SELECT o.district_id
    FROM public.organizations o
    WHERE o.id = public.current_org_id()
  )
);

DROP POLICY IF EXISTS districts_platform_write ON public.districts;
CREATE POLICY districts_platform_write ON public.districts
FOR ALL
USING (public.current_user_platform_admin())
WITH CHECK (public.current_user_platform_admin());

DROP POLICY IF EXISTS platform_admins_select ON public.platform_admins;
CREATE POLICY platform_admins_select ON public.platform_admins
FOR SELECT
USING (user_id = auth.uid() OR public.current_user_platform_admin());

DROP POLICY IF EXISTS platform_admins_write ON public.platform_admins;
CREATE POLICY platform_admins_write ON public.platform_admins
FOR ALL
USING (public.current_user_platform_admin())
WITH CHECK (public.current_user_platform_admin());

DROP POLICY IF EXISTS platform_parish_operators_select ON public.platform_parish_operators;
CREATE POLICY platform_parish_operators_select ON public.platform_parish_operators
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.current_user_platform_admin()
);

DROP POLICY IF EXISTS platform_parish_operators_write ON public.platform_parish_operators;
CREATE POLICY platform_parish_operators_write ON public.platform_parish_operators
FOR ALL
USING (public.current_user_platform_admin())
WITH CHECK (public.current_user_platform_admin());

DROP POLICY IF EXISTS diocese_officers_select ON public.diocese_officers;
CREATE POLICY diocese_officers_select ON public.diocese_officers
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.current_user_platform_admin()
  OR diocese_id = public.current_user_diocese_id()
);

DROP POLICY IF EXISTS diocese_officers_write ON public.diocese_officers;
CREATE POLICY diocese_officers_write ON public.diocese_officers
FOR ALL
USING (public.current_user_platform_admin())
WITH CHECK (public.current_user_platform_admin());

DROP POLICY IF EXISTS district_officers_select ON public.district_officers;
CREATE POLICY district_officers_select ON public.district_officers
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.current_user_platform_admin()
  OR district_id = public.current_user_district_id()
);

DROP POLICY IF EXISTS district_officers_write ON public.district_officers;
CREATE POLICY district_officers_write ON public.district_officers
FOR ALL
USING (public.current_user_platform_admin())
WITH CHECK (public.current_user_platform_admin());

DROP POLICY IF EXISTS parish_transfers_select ON public.parish_membership_transfers;
CREATE POLICY parish_transfers_select ON public.parish_membership_transfers
FOR SELECT
USING (
  public.current_user_platform_admin()
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS parish_transfers_write ON public.parish_membership_transfers;
CREATE POLICY parish_transfers_write ON public.parish_membership_transfers
FOR INSERT
WITH CHECK (public.current_user_platform_admin());

GRANT SELECT ON public.dioceses TO authenticated;
GRANT SELECT ON public.districts TO authenticated;
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT SELECT ON public.platform_parish_operators TO authenticated;
GRANT SELECT ON public.diocese_officers TO authenticated;
GRANT SELECT ON public.district_officers TO authenticated;
GRANT SELECT ON public.parish_membership_transfers TO authenticated;
