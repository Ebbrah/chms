-- Public hierarchy data for the parish join picker (/join).

CREATE OR REPLACE FUNCTION public.list_parish_join_options()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'dioceses',
    COALESCE(
      (
        SELECT json_agg(json_build_object('id', d.id, 'name', d.name) ORDER BY d.name)
        FROM public.dioceses d
        WHERE EXISTS (
          SELECT 1
          FROM public.districts dist
          JOIN public.organizations o ON o.district_id = dist.id
          WHERE dist.diocese_id = d.id
            AND o.status = 'active'::public.org_status
            AND o.slug IS NOT NULL
            AND btrim(o.slug) <> ''
        )
      ),
      '[]'::json
    ),
    'districts',
    COALESCE(
      (
        SELECT json_agg(
          json_build_object('id', dist.id, 'name', dist.name, 'diocese_id', dist.diocese_id)
          ORDER BY dist.name
        )
        FROM public.districts dist
        WHERE EXISTS (
          SELECT 1
          FROM public.organizations o
          WHERE o.district_id = dist.id
            AND o.status = 'active'::public.org_status
            AND o.slug IS NOT NULL
            AND btrim(o.slug) <> ''
        )
      ),
      '[]'::json
    ),
    'parishes',
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', o.id,
            'display_name', COALESCE(o.display_name, o.name),
            'slug', o.slug,
            'district_id', o.district_id
          )
          ORDER BY COALESCE(o.display_name, o.name)
        )
        FROM public.organizations o
        WHERE o.status = 'active'::public.org_status
          AND o.slug IS NOT NULL
          AND btrim(o.slug) <> ''
      ),
      '[]'::json
    )
  );
$$;

REVOKE ALL ON FUNCTION public.list_parish_join_options () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_parish_join_options () TO anon, authenticated, service_role;
