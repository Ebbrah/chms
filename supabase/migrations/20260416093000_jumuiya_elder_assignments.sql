-- Map church elders to specific jumuiya groups.
CREATE TABLE IF NOT EXISTS public.jumuiya_elder_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, household_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_jumuiya_elders_user
ON public.jumuiya_elder_assignments (user_id);

CREATE OR REPLACE FUNCTION public.is_church_elder_for_household(_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jumuiya_elder_assignments jea
    WHERE jea.user_id = auth.uid()
      AND jea.org_id = public.current_org_id()
      AND jea.household_id = _household_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_jumuiya_members(_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.can_pastoral()
    OR (
      public.user_has_role_key('jumuiya_chairman')
      AND _household_id IS NOT NULL
      AND public.is_jumuiya_chair_for_household(_household_id)
    )
    OR (
      public.user_has_role_key('church_elder')
      AND _household_id IS NOT NULL
      AND public.is_church_elder_for_household(_household_id)
    )
$$;

ALTER TABLE public.jumuiya_elder_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY jumuiya_elders_select ON public.jumuiya_elder_assignments
FOR SELECT
USING (
  user_id = auth.uid()
  OR (org_id = public.current_org_id() AND public.user_is_admin())
);

CREATE POLICY jumuiya_elders_admin_write ON public.jumuiya_elder_assignments
FOR ALL
USING (org_id = public.current_org_id() AND public.user_is_admin())
WITH CHECK (org_id = public.current_org_id() AND public.user_is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jumuiya_elder_assignments TO authenticated;
