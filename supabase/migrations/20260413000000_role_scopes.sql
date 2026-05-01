-- Phase 1 role scopes:
-- 1) committee_head can access only assigned committee budgets
-- 2) jumuiya_chairman can view members/reports for assigned jumuiya (household)

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'committee_head';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'jumuiya_chairman';

CREATE TABLE IF NOT EXISTS public.committees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, key)
);

CREATE TABLE IF NOT EXISTS public.committee_heads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  committee_id uuid NOT NULL REFERENCES public.committees (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, committee_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.jumuiya_chair_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, household_id, user_id)
);

ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS committee_id uuid REFERENCES public.committees (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_committees_org ON public.committees (org_id);
CREATE INDEX IF NOT EXISTS idx_committee_heads_user ON public.committee_heads (user_id);
CREATE INDEX IF NOT EXISTS idx_jumuiya_chairs_user ON public.jumuiya_chair_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_committee ON public.budgets (committee_id);

INSERT INTO public.committees (org_id, key, name)
SELECT o.id, v.key, v.name
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('evangelism', 'Evangelism Committee'),
    ('planning', 'Planning Committee'),
    ('malezi', 'Malezi Committee'),
    ('diaconic', 'Diaconic Committee'),
    ('environmental', 'Environmental Committee')
) AS v(key, name)
ON CONFLICT (org_id, key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.user_heads_committee(_committee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.committee_heads ch
    WHERE ch.user_id = auth.uid()
      AND ch.org_id = public.current_org_id()
      AND ch.committee_id = _committee_id
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_role_key(_role text)
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
      AND ur.role::text = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_jumuiya_chair_for_household(_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jumuiya_chair_assignments jca
    WHERE jca.user_id = auth.uid()
      AND jca.org_id = public.current_org_id()
      AND jca.household_id = _household_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_budget_committee(_committee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.can_finance()
    OR (
      public.user_has_role_key('committee_head')
      AND _committee_id IS NOT NULL
      AND public.user_heads_committee(_committee_id)
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
$$;

ALTER TABLE public.committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jumuiya_chair_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY committees_select ON public.committees
FOR SELECT
USING (org_id = public.current_org_id());

CREATE POLICY committees_admin_write ON public.committees
FOR ALL
USING (org_id = public.current_org_id() AND public.user_is_admin())
WITH CHECK (org_id = public.current_org_id() AND public.user_is_admin());

CREATE POLICY committee_heads_select ON public.committee_heads
FOR SELECT
USING (
  user_id = auth.uid()
  OR (org_id = public.current_org_id() AND public.user_is_admin())
);

CREATE POLICY committee_heads_admin_write ON public.committee_heads
FOR ALL
USING (org_id = public.current_org_id() AND public.user_is_admin())
WITH CHECK (org_id = public.current_org_id() AND public.user_is_admin());

CREATE POLICY jumuiya_chairs_select ON public.jumuiya_chair_assignments
FOR SELECT
USING (
  user_id = auth.uid()
  OR (org_id = public.current_org_id() AND public.user_is_admin())
);

CREATE POLICY jumuiya_chairs_admin_write ON public.jumuiya_chair_assignments
FOR ALL
USING (org_id = public.current_org_id() AND public.user_is_admin())
WITH CHECK (org_id = public.current_org_id() AND public.user_is_admin());

DROP POLICY IF EXISTS households_select ON public.households;
CREATE POLICY households_select ON public.households
FOR SELECT
USING (
  org_id = public.current_org_id()
  AND (
    public.can_pastoral()
    OR public.is_jumuiya_chair_for_household(id)
  )
);

DROP POLICY IF EXISTS members_select ON public.members;
CREATE POLICY members_select ON public.members
FOR SELECT
USING (
  org_id = public.current_org_id()
  AND (
    public.can_pastoral()
    OR public.can_view_jumuiya_members(household_id)
    OR EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id = members.id
        AND m.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS finance_select ON public.fiscal_years;
CREATE POLICY finance_select ON public.fiscal_years
FOR SELECT
USING (
  org_id = public.current_org_id()
  AND (
    public.can_finance()
    OR public.user_has_role_key('committee_head')
  )
);

DROP POLICY IF EXISTS finance_accounts_select ON public.accounts;
CREATE POLICY finance_accounts_select ON public.accounts
FOR SELECT
USING (
  org_id = public.current_org_id()
  AND (
    public.can_finance()
    OR public.user_has_role_key('committee_head')
  )
);

DROP POLICY IF EXISTS finance_budgets ON public.budgets;
CREATE POLICY finance_budgets ON public.budgets
FOR ALL
USING (
  org_id = public.current_org_id()
  AND public.can_manage_budget_committee(committee_id)
)
WITH CHECK (
  org_id = public.current_org_id()
  AND public.can_manage_budget_committee(committee_id)
);

DROP POLICY IF EXISTS finance_budget_lines ON public.budget_lines;
CREATE POLICY finance_budget_lines ON public.budget_lines
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.budgets b
    WHERE b.id = budget_lines.budget_id
      AND b.org_id = public.current_org_id()
      AND public.can_manage_budget_committee(b.committee_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.budgets b
    WHERE b.id = budget_lines.budget_id
      AND b.org_id = public.current_org_id()
      AND public.can_manage_budget_committee(b.committee_id)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.committees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.committee_heads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jumuiya_chair_assignments TO authenticated;
