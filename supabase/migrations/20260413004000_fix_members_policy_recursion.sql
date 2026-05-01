-- Fix infinite recursion in members_select policy.
-- Previous policy referenced public.members inside its own USING clause.

DROP POLICY IF EXISTS members_select ON public.members;

CREATE POLICY members_select ON public.members
FOR SELECT
USING (
  org_id = public.current_org_id()
  AND (
    public.can_pastoral()
    OR public.can_view_jumuiya_members(household_id)
    OR user_id = auth.uid()
  )
);
