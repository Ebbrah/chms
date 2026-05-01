-- Add church elder role and update offerings workflow:
-- pending_authorization -> authorized -> approved / rejected

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'church_elder';

DO $$
BEGIN
  BEGIN
    ALTER TYPE public.offering_batch_status RENAME VALUE 'pending_approval' TO 'pending_authorization';
  EXCEPTION
    WHEN invalid_parameter_value THEN NULL;
  END;
END $$;

ALTER TYPE public.offering_batch_status ADD VALUE IF NOT EXISTS 'authorized';
ALTER TYPE public.offering_batch_status ADD VALUE IF NOT EXISTS 'rejected';

ALTER TABLE public.offering_week_batches
ADD COLUMN IF NOT EXISTS affected_rows integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS authorized_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS authorized_at timestamptz,
ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
ADD COLUMN IF NOT EXISTS rejected_reason text;

UPDATE public.offering_week_batches
SET status = 'pending_authorization'
WHERE status::text = 'pending_approval';

DROP POLICY IF EXISTS offering_week_batches_select ON public.offering_week_batches;
DROP POLICY IF EXISTS offering_week_batches_insert ON public.offering_week_batches;
DROP POLICY IF EXISTS offering_week_batches_update ON public.offering_week_batches;

CREATE POLICY offering_week_batches_select ON public.offering_week_batches
FOR SELECT
USING (
  org_id = public.current_org_id()
  AND (
    public.user_is_admin()
    OR public.user_is_treasurer()
    OR public.user_has_role_key('committee_head')
    OR public.user_has_role_key('church_elder')
  )
);

CREATE POLICY offering_week_batches_insert ON public.offering_week_batches
FOR INSERT
WITH CHECK (
  org_id = public.current_org_id()
  AND (
    public.user_is_admin()
    OR public.user_has_role_key('committee_head')
    OR public.user_has_role_key('church_elder')
  )
);

CREATE POLICY offering_week_batches_update ON public.offering_week_batches
FOR UPDATE
USING (
  org_id = public.current_org_id()
  AND (
    public.user_is_admin()
    OR public.user_is_treasurer()
    OR public.user_has_role_key('committee_head')
  )
)
WITH CHECK (
  org_id = public.current_org_id()
  AND (
    public.user_is_admin()
    OR public.user_is_treasurer()
    OR public.user_has_role_key('committee_head')
  )
);

DROP POLICY IF EXISTS offerings_select ON public.offerings;
CREATE POLICY offerings_select ON public.offerings
FOR SELECT
USING (
  org_id = public.current_org_id()
  AND (
    public.user_is_admin()
    OR public.user_is_treasurer()
    OR public.user_has_role_key('committee_head')
    OR public.user_has_role_key('church_elder')
    OR EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id = offerings.member_id
        AND m.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS offerings_insert_pastor ON public.offerings;

CREATE POLICY offerings_insert_weekly_roles ON public.offerings
FOR INSERT
WITH CHECK (
  org_id = public.current_org_id()
  AND (
    public.user_is_admin()
    OR public.user_has_role_key('committee_head')
    OR public.user_has_role_key('church_elder')
  )
  AND batch_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.offering_week_batches b
    WHERE b.id = offerings.batch_id
      AND b.org_id = public.current_org_id()
      AND b.status::text IN ('pending_authorization', 'rejected')
  )
);

CREATE POLICY offerings_update_weekly_roles ON public.offerings
FOR UPDATE
USING (
  org_id = public.current_org_id()
  AND (
    public.user_is_admin()
    OR public.user_has_role_key('committee_head')
    OR public.user_has_role_key('church_elder')
  )
  AND batch_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.offering_week_batches b
    WHERE b.id = offerings.batch_id
      AND b.org_id = public.current_org_id()
      AND b.status::text IN ('pending_authorization', 'rejected')
  )
)
WITH CHECK (
  org_id = public.current_org_id()
  AND (
    public.user_is_admin()
    OR public.user_has_role_key('committee_head')
    OR public.user_has_role_key('church_elder')
  )
  AND batch_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.offering_week_batches b
    WHERE b.id = offerings.batch_id
      AND b.org_id = public.current_org_id()
      AND b.status::text IN ('pending_authorization', 'rejected')
  )
);
