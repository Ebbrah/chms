-- MT-Phase 2: Platform admin operations — org updates, context switch, roll-ups.

-- Parish context switch for platform admin / parish operators (not pastors).
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS context_org_id uuid REFERENCES public.organizations (id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    CASE
      WHEN p.context_org_id IS NOT NULL
        AND (
          public.current_user_platform_admin()
          OR public.current_user_platform_parish_operator(p.context_org_id)
        )
      THEN p.context_org_id
      ELSE NULL
    END,
    p.org_id
  )
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.set_operator_context_org(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _org_id IS NULL THEN
    UPDATE public.profiles
    SET context_org_id = NULL
    WHERE id = auth.uid();
    RETURN;
  END IF;

  IF NOT (
    public.current_user_platform_admin()
    OR public.current_user_platform_parish_operator(_org_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this parish context';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = _org_id
      AND o.status = 'active'::public.org_status
  ) THEN
    RAISE EXCEPTION 'Parish is not active';
  END IF;

  UPDATE public.profiles
  SET context_org_id = _org_id
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_operator_context_org (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_operator_context_org (uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS org_platform_write ON public.organizations;
CREATE POLICY org_platform_write ON public.organizations
FOR UPDATE
USING (public.current_user_platform_admin())
WITH CHECK (public.current_user_platform_admin());

CREATE OR REPLACE FUNCTION public.update_org_features(_org_id uuid, _features jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;

  UPDATE public.organizations o
  SET settings = jsonb_set(
    COALESCE(o.settings, '{}'::jsonb),
    '{features}',
    COALESCE(o.settings -> 'features', '{}'::jsonb) || _features,
    true
  )
  WHERE o.id = _org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_org_features (uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_org_features (uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_parish_status(_org_id uuid, _status public.org_status)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;

  UPDATE public.organizations
  SET status = _status
  WHERE id = _org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_parish_status (uuid, public.org_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_parish_status (uuid, public.org_status) TO authenticated, service_role;

-- Totals-only platform roll-up (no member-level PII).
CREATE OR REPLACE FUNCTION public.report_platform_rollups()
RETURNS TABLE (
  parish_count bigint,
  active_parish_count bigint,
  suspended_parish_count bigint,
  total_members bigint,
  active_members bigint,
  total_offerings_amount numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.organizations)::bigint AS parish_count,
    (
      SELECT count(*)
      FROM public.organizations o
      WHERE o.status = 'active'::public.org_status
    )::bigint AS active_parish_count,
    (
      SELECT count(*)
      FROM public.organizations o
      WHERE o.status = 'suspended'::public.org_status
    )::bigint AS suspended_parish_count,
    (SELECT count(*) FROM public.members)::bigint AS total_members,
    (
      SELECT count(*)
      FROM public.members m
      WHERE m.status = 'active'
    )::bigint AS active_members,
    COALESCE((SELECT sum(o.amount) FROM public.offerings o), 0)::numeric AS total_offerings_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.report_platform_rollups () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_platform_rollups () TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.report_parish_counts_by_district()
RETURNS TABLE (
  district_id uuid,
  district_name text,
  diocese_name text,
  parish_count bigint,
  member_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;

  RETURN QUERY
  SELECT
    d.id AS district_id,
    d.name AS district_name,
    dio.name AS diocese_name,
    count(DISTINCT o.id)::bigint AS parish_count,
    count(m.id)::bigint AS member_count
  FROM public.districts d
  JOIN public.dioceses dio ON dio.id = d.diocese_id
  LEFT JOIN public.organizations o ON o.district_id = d.id
  LEFT JOIN public.members m ON m.org_id = o.id
  GROUP BY d.id, d.name, dio.name
  ORDER BY dio.name, d.name;
END;
$$;

REVOKE ALL ON FUNCTION public.report_parish_counts_by_district () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_parish_counts_by_district () TO authenticated, service_role;
