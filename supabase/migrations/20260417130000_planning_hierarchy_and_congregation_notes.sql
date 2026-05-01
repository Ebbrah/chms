-- Planning hierarchy: Kipaumbele -> Lengo -> Shabaha
-- Plus congregation notes and target linkage to budget lines.

CREATE TABLE IF NOT EXISTS public.planning_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planning_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  priority_id uuid NOT NULL REFERENCES public.planning_priorities (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planning_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.planning_goals (id) ON DELETE CASCADE,
  name text NOT NULL,
  indicator text,
  expected_result text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_lines
ADD COLUMN IF NOT EXISTS target_id uuid REFERENCES public.planning_targets (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_planning_priorities_org ON public.planning_priorities (org_id);
CREATE INDEX IF NOT EXISTS idx_planning_goals_org ON public.planning_goals (org_id);
CREATE INDEX IF NOT EXISTS idx_planning_goals_priority ON public.planning_goals (priority_id);
CREATE INDEX IF NOT EXISTS idx_planning_targets_org ON public.planning_targets (org_id);
CREATE INDEX IF NOT EXISTS idx_planning_targets_goal ON public.planning_targets (goal_id);
CREATE INDEX IF NOT EXISTS idx_budget_lines_target ON public.budget_lines (target_id);

CREATE OR REPLACE FUNCTION public.user_heads_planning_committee()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.committee_heads ch
    JOIN public.committees c ON c.id = ch.committee_id
    WHERE ch.user_id = auth.uid()
      AND ch.org_id = public.current_org_id()
      AND c.org_id = public.current_org_id()
      AND c.key = 'planning'
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_planning_hierarchy()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_finance()
    OR (
      public.user_has_role_key('committee_head')
      AND public.user_heads_planning_committee()
    )
$$;

ALTER TABLE public.planning_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY planning_priorities_read ON public.planning_priorities
FOR SELECT
USING (org_id = public.current_org_id());

CREATE POLICY planning_priorities_write ON public.planning_priorities
FOR ALL
USING (org_id = public.current_org_id() AND public.can_manage_planning_hierarchy())
WITH CHECK (org_id = public.current_org_id() AND public.can_manage_planning_hierarchy());

CREATE POLICY planning_goals_read ON public.planning_goals
FOR SELECT
USING (org_id = public.current_org_id());

CREATE POLICY planning_goals_write ON public.planning_goals
FOR ALL
USING (org_id = public.current_org_id() AND public.can_manage_planning_hierarchy())
WITH CHECK (org_id = public.current_org_id() AND public.can_manage_planning_hierarchy());

CREATE POLICY planning_targets_read ON public.planning_targets
FOR SELECT
USING (org_id = public.current_org_id());

CREATE POLICY planning_targets_write ON public.planning_targets
FOR ALL
USING (org_id = public.current_org_id() AND public.can_manage_planning_hierarchy())
WITH CHECK (org_id = public.current_org_id() AND public.can_manage_planning_hierarchy());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_priorities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_targets TO authenticated;

CREATE TABLE IF NOT EXISTS public.congregation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  household_id uuid REFERENCES public.households (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_congregation_notes_org_created
ON public.congregation_notes (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_congregation_notes_household
ON public.congregation_notes (household_id);

CREATE OR REPLACE FUNCTION public.can_publish_global_note()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_role_key('pastor')
    OR (
      public.user_has_role_key('committee_head')
      AND public.user_heads_planning_committee()
    )
$$;

CREATE OR REPLACE FUNCTION public.can_publish_jumuiya_note(_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _household_id IS NOT NULL
    AND public.user_has_role_key('jumuiya_chairman')
    AND public.is_jumuiya_chair_for_household(_household_id)
$$;

ALTER TABLE public.congregation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY congregation_notes_read ON public.congregation_notes
FOR SELECT
USING (
  org_id = public.current_org_id()
  AND (
    public.can_pastoral()
    OR household_id IS NULL
    OR public.is_jumuiya_chair_for_household(household_id)
    OR EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.org_id = public.current_org_id()
        AND m.user_id = auth.uid()
        AND m.household_id = congregation_notes.household_id
    )
  )
);

CREATE POLICY congregation_notes_insert ON public.congregation_notes
FOR INSERT
WITH CHECK (
  org_id = public.current_org_id()
  AND author_user_id = auth.uid()
  AND (
    (household_id IS NULL AND public.can_publish_global_note())
    OR public.can_publish_jumuiya_note(household_id)
  )
);

CREATE POLICY congregation_notes_update_delete ON public.congregation_notes
FOR ALL
USING (
  org_id = public.current_org_id()
  AND (public.user_is_admin() OR author_user_id = auth.uid())
)
WITH CHECK (
  org_id = public.current_org_id()
  AND (public.user_is_admin() OR author_user_id = auth.uid())
  AND (
    (household_id IS NULL AND public.can_publish_global_note())
    OR public.can_publish_jumuiya_note(household_id)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.congregation_notes TO authenticated;
