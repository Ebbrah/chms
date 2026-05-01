-- Treasurers/finance need chair↔jumuiya mapping for member profile forms (same pattern as jumuiya_elders_select_finance).
CREATE POLICY jumuiya_chairs_select_finance ON public.jumuiya_chair_assignments FOR
SELECT
USING (org_id = public.current_org_id () AND public.can_finance ());
