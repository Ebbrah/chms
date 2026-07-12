-- Fix registry search STABLE+INSERT violation, slow member search, and
-- platform-admin profile lookup that timed out under RLS.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Fast exact email lookup for platform admin officer assignment.
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower
  ON public.profiles (lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';

-- Trigram indexes for cross-parish registry name/number search.
-- (member full names live in JSONB and cannot be indexed with pg_trgm directly.)
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm
  ON public.profiles
  USING gin (lower(COALESCE(full_name, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_members_offering_number_trgm
  ON public.members
  USING gin (lower(COALESCE(offering_number, '')) gin_trgm_ops);

-- Platform admins need cross-parish email resolution; direct table queries
-- scan all profiles under RLS and can hit statement timeout.
CREATE OR REPLACE FUNCTION public.lookup_profile_id_by_email(_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id uuid;
BEGIN
  IF NOT public.current_user_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;

  SELECT p.id INTO profile_id
  FROM public.profiles p
  WHERE p.email IS NOT NULL
    AND lower(trim(p.email)) = lower(trim(_email))
  LIMIT 1;

  RETURN profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_profile_id_by_email (text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_profile_id_by_email (text) TO authenticated, service_role;

-- Must be VOLATILE because it writes audit rows; use trigram-friendly patterns.
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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q text := lower(trim(COALESCE(_query, '')));
  recent_count int;
  result_count int := 0;
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
  WITH hits AS (
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
    ORDER BY 1
    LIMIT 50
  )
  SELECT h.full_name, h.parish_name, h.member_status, h.offering_number
  FROM hits h;

  GET DIAGNOSTICS result_count = ROW_COUNT;

  INSERT INTO public.registry_search_audit (user_id, scope_type, scope_id, query, result_count)
  VALUES (auth.uid(), _scope_type, _scope_id, q, result_count);
END;
$$;
