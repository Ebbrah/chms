-- MT-Phase 4 v2: Regional governance — re-applies after revert migration.
-- Uses MT-1 member_demographic_flags(); financial totals count approved batches only.

CREATE TABLE IF NOT EXISTS public.registry_search_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('platform', 'diocese', 'district')),
  scope_id uuid,
  query text NOT NULL,
  result_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_search_audit_user_time
ON public.registry_search_audit (user_id, created_at DESC);

ALTER TABLE public.registry_search_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS registry_search_audit_select ON public.registry_search_audit;
CREATE POLICY registry_search_audit_select ON public.registry_search_audit
FOR SELECT TO authenticated
USING (
  public.current_user_platform_admin()
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS registry_search_audit_insert ON public.registry_search_audit;
CREATE POLICY registry_search_audit_insert ON public.registry_search_audit
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON public.registry_search_audit TO authenticated;

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_is_diocese_officer(_diocese_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.diocese_officers dof
    WHERE dof.user_id = auth.uid()
      AND dof.diocese_id = _diocese_id
  )
$$;

CREATE OR REPLACE FUNCTION public.user_is_district_officer(_district_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.district_officers dof
    WHERE dof.user_id = auth.uid()
      AND dof.district_id = _district_id
  )
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_diocese_demographics(_diocese_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_platform_admin()
    OR public.user_is_diocese_officer(_diocese_id)
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_district_demographics(_district_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_platform_admin()
    OR public.user_is_district_officer(_district_id)
    OR EXISTS (
      SELECT 1
      FROM public.districts d
      WHERE d.id = _district_id
        AND public.user_is_diocese_officer(d.diocese_id)
    )
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_diocese_finance(_diocese_id uuid)
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
      FROM public.diocese_officers dof
      WHERE dof.user_id = auth.uid()
        AND dof.diocese_id = _diocese_id
        AND dof.role = 'diocese_treasurer'::public.diocese_officer_role
    )
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_district_finance(_district_id uuid)
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
      FROM public.district_officers dof
      WHERE dof.user_id = auth.uid()
        AND dof.district_id = _district_id
        AND dof.role = 'district_treasurer'::public.district_officer_role
    )
$$;

CREATE OR REPLACE FUNCTION public.user_can_search_registry(_scope_type text, _scope_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_platform_admin() THEN
    RETURN true;
  END IF;

  IF _scope_type = 'diocese' THEN
    RETURN public.user_is_diocese_officer(_scope_id);
  END IF;

  IF _scope_type = 'district' THEN
    RETURN public.user_is_district_officer(_scope_id);
  END IF;

  RETURN false;
END;
$$;

-- ---------------------------------------------------------------------------
-- Demographic aggregation — reuse MT-1 member_demographic_flags()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_district_demographics(_district_id uuid)
RETURNS TABLE (
  total_members bigint,
  active_members bigint,
  inactive_members bigint,
  male_count bigint,
  female_count bigint,
  children_count bigint,
  youth_count bigint,
  adults_count bigint,
  orphans_count bigint,
  widows_count bigint,
  unknown_gender bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  child_max int := 12;
  youth_max int := 35;
BEGIN
  IF NOT public.user_can_view_district_demographics(_district_id) THEN
    RAISE EXCEPTION 'Not authorized for district demographics';
  END IF;

  SELECT
    COALESCE((d.settings -> 'demographic_bands' ->> 'child_max')::int, 12),
    COALESCE((d.settings -> 'demographic_bands' ->> 'youth_max')::int, 35)
  INTO child_max, youth_max
  FROM public.districts dist
  JOIN public.dioceses d ON d.id = dist.diocese_id
  WHERE dist.id = _district_id;

  RETURN QUERY
  SELECT
    count(*)::bigint,
    count(*) FILTER (WHERE m.status = 'active')::bigint,
    count(*) FILTER (WHERE m.status IS DISTINCT FROM 'active')::bigint,
    count(*) FILTER (WHERE d.is_male)::bigint,
    count(*) FILTER (WHERE d.is_female)::bigint,
    count(*) FILTER (WHERE d.age_band = 'child')::bigint,
    count(*) FILTER (WHERE d.age_band = 'youth')::bigint,
    count(*) FILTER (WHERE d.age_band = 'adult')::bigint,
    count(*) FILTER (WHERE d.is_orphan)::bigint,
    count(*) FILTER (WHERE d.is_widow)::bigint,
    count(*) FILTER (WHERE d.gender_category = 'unknown')::bigint
  FROM public.members m
  JOIN public.organizations o ON o.id = m.org_id
  CROSS JOIN LATERAL public.member_demographic_flags(
    COALESCE(m.member_details, '{}'::jsonb),
    child_max,
    youth_max
  ) d
  WHERE o.district_id = _district_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_diocese_demographics(_diocese_id uuid)
RETURNS TABLE (
  total_members bigint,
  active_members bigint,
  inactive_members bigint,
  male_count bigint,
  female_count bigint,
  children_count bigint,
  youth_count bigint,
  adults_count bigint,
  orphans_count bigint,
  widows_count bigint,
  unknown_gender bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  child_max int := 12;
  youth_max int := 35;
BEGIN
  IF NOT public.user_can_view_diocese_demographics(_diocese_id) THEN
    RAISE EXCEPTION 'Not authorized for diocese demographics';
  END IF;

  SELECT
    COALESCE((d.settings -> 'demographic_bands' ->> 'child_max')::int, 12),
    COALESCE((d.settings -> 'demographic_bands' ->> 'youth_max')::int, 35)
  INTO child_max, youth_max
  FROM public.dioceses d
  WHERE d.id = _diocese_id;

  RETURN QUERY
  SELECT
    count(*)::bigint,
    count(*) FILTER (WHERE m.status = 'active')::bigint,
    count(*) FILTER (WHERE m.status IS DISTINCT FROM 'active')::bigint,
    count(*) FILTER (WHERE d.is_male)::bigint,
    count(*) FILTER (WHERE d.is_female)::bigint,
    count(*) FILTER (WHERE d.age_band = 'child')::bigint,
    count(*) FILTER (WHERE d.age_band = 'youth')::bigint,
    count(*) FILTER (WHERE d.age_band = 'adult')::bigint,
    count(*) FILTER (WHERE d.is_orphan)::bigint,
    count(*) FILTER (WHERE d.is_widow)::bigint,
    count(*) FILTER (WHERE d.gender_category = 'unknown')::bigint
  FROM public.members m
  JOIN public.organizations o ON o.id = m.org_id
  JOIN public.districts dist ON dist.id = o.district_id
  CROSS JOIN LATERAL public.member_demographic_flags(
    COALESCE(m.member_details, '{}'::jsonb),
    child_max,
    youth_max
  ) d
  WHERE dist.diocese_id = _diocese_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_district_demographics_by_parish(_district_id uuid)
RETURNS TABLE (
  org_id uuid,
  parish_name text,
  total_members bigint,
  active_members bigint,
  male_count bigint,
  female_count bigint,
  children_count bigint,
  youth_count bigint,
  orphans_count bigint,
  widows_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  child_max int := 12;
  youth_max int := 35;
BEGIN
  IF NOT public.user_can_view_district_demographics(_district_id) THEN
    RAISE EXCEPTION 'Not authorized for district demographics';
  END IF;

  SELECT
    COALESCE((d.settings -> 'demographic_bands' ->> 'child_max')::int, 12),
    COALESCE((d.settings -> 'demographic_bands' ->> 'youth_max')::int, 35)
  INTO child_max, youth_max
  FROM public.districts dist
  JOIN public.dioceses d ON d.id = dist.diocese_id
  WHERE dist.id = _district_id;

  RETURN QUERY
  SELECT
    o.id,
    COALESCE(o.display_name, o.name),
    count(m.id)::bigint,
    count(m.id) FILTER (WHERE m.status = 'active')::bigint,
    count(m.id) FILTER (WHERE d.is_male)::bigint,
    count(m.id) FILTER (WHERE d.is_female)::bigint,
    count(m.id) FILTER (WHERE d.age_band = 'child')::bigint,
    count(m.id) FILTER (WHERE d.age_band = 'youth')::bigint,
    count(m.id) FILTER (WHERE d.is_orphan)::bigint,
    count(m.id) FILTER (WHERE d.is_widow)::bigint
  FROM public.organizations o
  LEFT JOIN public.members m ON m.org_id = o.id
  LEFT JOIN LATERAL public.member_demographic_flags(
    COALESCE(m.member_details, '{}'::jsonb),
    child_max,
    youth_max
  ) d ON m.id IS NOT NULL
  WHERE o.district_id = _district_id
  GROUP BY o.id, o.display_name, o.name
  ORDER BY COALESCE(o.display_name, o.name);
END;
$$;

CREATE OR REPLACE FUNCTION public.report_diocese_demographics_by_parish(_diocese_id uuid)
RETURNS TABLE (
  org_id uuid,
  parish_name text,
  district_name text,
  total_members bigint,
  active_members bigint,
  male_count bigint,
  female_count bigint,
  children_count bigint,
  youth_count bigint,
  orphans_count bigint,
  widows_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  child_max int := 12;
  youth_max int := 35;
BEGIN
  IF NOT public.user_can_view_diocese_demographics(_diocese_id) THEN
    RAISE EXCEPTION 'Not authorized for diocese demographics';
  END IF;

  SELECT
    COALESCE((d.settings -> 'demographic_bands' ->> 'child_max')::int, 12),
    COALESCE((d.settings -> 'demographic_bands' ->> 'youth_max')::int, 35)
  INTO child_max, youth_max
  FROM public.dioceses d
  WHERE d.id = _diocese_id;

  RETURN QUERY
  SELECT
    o.id,
    COALESCE(o.display_name, o.name),
    dist.name,
    count(m.id)::bigint,
    count(m.id) FILTER (WHERE m.status = 'active')::bigint,
    count(m.id) FILTER (WHERE d.is_male)::bigint,
    count(m.id) FILTER (WHERE d.is_female)::bigint,
    count(m.id) FILTER (WHERE d.age_band = 'child')::bigint,
    count(m.id) FILTER (WHERE d.age_band = 'youth')::bigint,
    count(m.id) FILTER (WHERE d.is_orphan)::bigint,
    count(m.id) FILTER (WHERE d.is_widow)::bigint
  FROM public.organizations o
  JOIN public.districts dist ON dist.id = o.district_id
  LEFT JOIN public.members m ON m.org_id = o.id
  LEFT JOIN LATERAL public.member_demographic_flags(
    COALESCE(m.member_details, '{}'::jsonb),
    child_max,
    youth_max
  ) d ON m.id IS NOT NULL
  WHERE dist.diocese_id = _diocese_id
  GROUP BY o.id, o.display_name, o.name, dist.name
  ORDER BY dist.name, COALESCE(o.display_name, o.name);
END;
$$;

-- ---------------------------------------------------------------------------
-- Financial totals (approved offering batches only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_district_financial_totals(
  _district_id uuid,
  _start date DEFAULT NULL,
  _end date DEFAULT NULL
)
RETURNS TABLE (
  total_offerings numeric,
  parish_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_can_view_district_finance(_district_id) THEN
    RAISE EXCEPTION 'Not authorized for district financial totals';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(sum(off.amount), 0)::numeric,
    count(DISTINCT o.id)::bigint
  FROM public.organizations o
  LEFT JOIN public.offerings off ON off.org_id = o.id
    AND off.batch_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.offering_week_batches b
      WHERE b.id = off.batch_id
        AND b.status = 'approved'::public.offering_batch_status
    )
    AND (_start IS NULL OR off.received_at::date >= _start)
    AND (_end IS NULL OR off.received_at::date <= _end)
  WHERE o.district_id = _district_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_diocese_financial_totals(
  _diocese_id uuid,
  _start date DEFAULT NULL,
  _end date DEFAULT NULL
)
RETURNS TABLE (
  total_offerings numeric,
  parish_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_can_view_diocese_finance(_diocese_id) THEN
    RAISE EXCEPTION 'Not authorized for diocese financial totals';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(sum(off.amount), 0)::numeric,
    count(DISTINCT o.id)::bigint
  FROM public.organizations o
  JOIN public.districts dist ON dist.id = o.district_id
  LEFT JOIN public.offerings off ON off.org_id = o.id
    AND off.batch_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.offering_week_batches b
      WHERE b.id = off.batch_id
        AND b.status = 'approved'::public.offering_batch_status
    )
    AND (_start IS NULL OR off.received_at::date >= _start)
    AND (_end IS NULL OR off.received_at::date <= _end)
  WHERE dist.diocese_id = _diocese_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_district_financial_by_parish(
  _district_id uuid,
  _start date DEFAULT NULL,
  _end date DEFAULT NULL
)
RETURNS TABLE (
  org_id uuid,
  parish_name text,
  total_offerings numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_can_view_district_finance(_district_id) THEN
    RAISE EXCEPTION 'Not authorized for district financial totals';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    COALESCE(o.display_name, o.name),
    COALESCE(sum(off.amount), 0)::numeric
  FROM public.organizations o
  LEFT JOIN public.offerings off ON off.org_id = o.id
    AND off.batch_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.offering_week_batches b
      WHERE b.id = off.batch_id
        AND b.status = 'approved'::public.offering_batch_status
    )
    AND (_start IS NULL OR off.received_at::date >= _start)
    AND (_end IS NULL OR off.received_at::date <= _end)
  WHERE o.district_id = _district_id
  GROUP BY o.id, o.display_name, o.name
  ORDER BY COALESCE(o.display_name, o.name);
END;
$$;

-- ---------------------------------------------------------------------------
-- Registry search (limited fields, audited, rate-limited)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_member_registry(
  _scope_type text,
  _scope_id uuid,
  _query text
)
RETURNS TABLE (
  full_name text,
  parish_name text,
  member_status text,
  offering_number text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q text := lower(trim(COALESCE(_query, '')));
  recent_count int;
BEGIN
  IF length(q) < 2 THEN
    RAISE EXCEPTION 'Search query must be at least 2 characters';
  END IF;

  IF NOT public.user_can_search_registry(_scope_type, _scope_id) THEN
    RAISE EXCEPTION 'Not authorized for registry search in this scope';
  END IF;

  SELECT count(*)::int INTO recent_count
  FROM public.registry_search_audit a
  WHERE a.user_id = auth.uid()
    AND a.created_at > now() - interval '1 minute';

  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'Too many searches — please wait a minute and try again';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(m.member_details ->> 'full_name', p.full_name, m.email, 'Unknown') AS full_name,
    COALESCE(o.display_name, o.name) AS parish_name,
    COALESCE(m.status, 'unknown') AS member_status,
    COALESCE(m.offering_number, '') AS offering_number
  FROM public.members m
  JOIN public.organizations o ON o.id = m.org_id
  JOIN public.districts dist ON dist.id = o.district_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE (
    lower(COALESCE(m.member_details ->> 'full_name', '')) LIKE '%' || q || '%'
    OR lower(COALESCE(p.full_name, '')) LIKE '%' || q || '%'
    OR lower(COALESCE(m.offering_number, '')) LIKE '%' || q || '%'
  )
  AND (
    (_scope_type = 'diocese' AND dist.diocese_id = _scope_id)
    OR (_scope_type = 'district' AND o.district_id = _scope_id)
    OR (_scope_type = 'platform' AND public.current_user_platform_admin())
  )
  ORDER BY full_name
  LIMIT 50;

  GET DIAGNOSTICS recent_count = ROW_COUNT;

  INSERT INTO public.registry_search_audit (user_id, scope_type, scope_id, query, result_count)
  VALUES (auth.uid(), _scope_type, _scope_id, q, recent_count);
END;
$$;

-- Officer assignment (platform admin)
CREATE OR REPLACE FUNCTION public.assign_diocese_officer(
  _diocese_id uuid,
  _user_id uuid,
  _role public.diocese_officer_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;

  INSERT INTO public.diocese_officers (diocese_id, user_id, role)
  VALUES (_diocese_id, _user_id, _role)
  ON CONFLICT (diocese_id, user_id, role) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_district_officer(
  _district_id uuid,
  _user_id uuid,
  _role public.district_officer_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;

  INSERT INTO public.district_officers (district_id, user_id, role)
  VALUES (_district_id, _user_id, _role)
  ON CONFLICT (district_id, user_id, role) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_diocese_officer(_officer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;

  DELETE FROM public.diocese_officers WHERE id = _officer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_district_officer(_officer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;

  DELETE FROM public.district_officers WHERE id = _officer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.report_district_demographics (uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_diocese_demographics (uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_district_demographics_by_parish (uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_diocese_demographics_by_parish (uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_district_financial_totals (uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_diocese_financial_totals (uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_district_financial_by_parish (uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_member_registry (text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_diocese_officer (uuid, uuid, public.diocese_officer_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_district_officer (uuid, uuid, public.district_officer_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_diocese_officer (uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_district_officer (uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.report_district_demographics (uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_diocese_demographics (uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_district_demographics_by_parish (uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_diocese_demographics_by_parish (uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_district_financial_totals (uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_diocese_financial_totals (uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_district_financial_by_parish (uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_member_registry (text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_diocese_officer (uuid, uuid, public.diocese_officer_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_district_officer (uuid, uuid, public.district_officer_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_diocese_officer (uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_district_officer (uuid) TO authenticated, service_role;
