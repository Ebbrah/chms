-- Aggregate member pledge giving by bucket for dashboard (avoids fetching thousands of offering rows).
CREATE OR REPLACE FUNCTION public.get_member_yearly_pledge_totals(
  _member_id uuid,
  _year int
)
RETURNS TABLE (ahadi numeric, jengo numeric, dayosisi numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(o.amount) FILTER (
      WHERE lower(ot.name) LIKE '%ahadi%'
    ), 0) AS ahadi,
    COALESCE(SUM(o.amount) FILTER (
      WHERE lower(ot.name) LIKE '%jengo%'
    ), 0) AS jengo,
    COALESCE(SUM(o.amount) FILTER (
      WHERE lower(ot.name) LIKE '%maendeleo%' OR lower(ot.name) LIKE '%dayosisi%'
    ), 0) AS dayosisi
  FROM public.offerings o
  JOIN public.offering_types ot ON ot.id = o.offering_type_id
  WHERE o.member_id = _member_id
    AND o.received_at >= make_timestamptz(_year, 1, 1, 0, 0, 0, 'UTC')
    AND o.received_at < make_timestamptz(_year + 1, 1, 1, 0, 0, 0, 'UTC');
$$;

GRANT EXECUTE ON FUNCTION public.get_member_yearly_pledge_totals(uuid, int) TO authenticated;
