-- Weekly offering batches, treasurer approval → ledger, reporting access for planning chair

CREATE TYPE public.offering_batch_status AS ENUM ('pending_approval', 'approved', 'void');

CREATE TABLE public.offering_week_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  status public.offering_batch_status NOT NULL DEFAULT 'pending_approval',
  recorded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at timestamptz,
  journal_entry_id uuid REFERENCES public.journal_entries (id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now (),
  CONSTRAINT chk_week_dates CHECK (week_end_date >= week_start_date)
);

CREATE INDEX idx_offering_week_batches_org_week ON public.offering_week_batches (org_id, week_start_date DESC);
CREATE INDEX idx_offering_week_batches_org_status ON public.offering_week_batches (org_id, status);

ALTER TABLE public.offerings
ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.offering_week_batches (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS budget_posted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_offerings_batch ON public.offerings (batch_id)
WHERE
  batch_id IS NOT NULL;

-- Planning committee head (Mipango) — used for offerings report RLS
CREATE OR REPLACE FUNCTION public.user_heads_planning_committee ()
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
    WHERE ch.user_id = auth.uid ()
      AND ch.org_id = public.current_org_id ()
      AND c.key = 'planning'
  );
$$;

-- Treasurer-only approval (admin may also approve in UI)
CREATE OR REPLACE FUNCTION public.user_is_treasurer ()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_any_role (ARRAY['treasurer']::public.app_role[]);
$$;

ALTER TABLE public.offering_week_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY offering_week_batches_select ON public.offering_week_batches FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND (
      public.can_finance ()
      OR public.can_pastoral ()
      OR public.user_heads_planning_committee ()
    )
  );

-- Finance or pastor may record weekly batches; approval remains finance-only (UPDATE policy below).
CREATE POLICY offering_week_batches_insert ON public.offering_week_batches FOR INSERT
WITH CHECK (
  org_id = public.current_org_id ()
  AND (
    public.can_finance ()
    OR public.user_has_any_role (ARRAY['pastor']::public.app_role[])
  )
);

CREATE POLICY offering_week_batches_update ON public.offering_week_batches FOR
UPDATE
  USING (
    org_id = public.current_org_id ()
    AND public.can_finance ()
  )
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.can_finance ()
);

-- Members: planning chair can read members for reporting (same org)
CREATE POLICY members_select_planning ON public.members FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND public.user_heads_planning_committee ()
  );

-- Offerings: planning chair can read all org offerings for reports
CREATE POLICY offerings_select_planning_reports ON public.offerings FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND public.user_heads_planning_committee ()
  );

-- Replace single offerings write policy: finance full access; pastor may insert only
DROP POLICY IF EXISTS offerings_write ON public.offerings;

CREATE POLICY offerings_write_finance ON public.offerings FOR ALL USING (
  org_id = public.current_org_id ()
  AND public.can_finance ()
)
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.can_finance ()
);

CREATE POLICY offerings_insert_pastor ON public.offerings FOR INSERT
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.user_has_any_role (ARRAY['pastor']::public.app_role[])
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offering_week_batches TO authenticated;
