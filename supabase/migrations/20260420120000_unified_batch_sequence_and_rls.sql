-- batch_slot = mkondo wa ukusanyaji ndani ya wiki (1, 2, 3, …) — sio tena “Jumapili vs katikati” pekee
ALTER TABLE public.offering_week_batches DROP CONSTRAINT IF EXISTS offering_week_batches_batch_slot_check;

ALTER TABLE public.offering_week_batches
ADD CONSTRAINT offering_week_batches_batch_slot_positive CHECK (
  batch_slot >= 1
  AND batch_slot <= 100
);

COMMENT ON COLUMN public.offering_week_batches.batch_slot IS 'Mkondo wa ukusanyaji ndani ya wiki ya Jumamosi–Jumamosi (1 = wa kwanza kabla ya kuidhinishwa, 2 = baada ya kuidhinishwa wa kwanza, nk.)';

-- Simplify RLS: roles may write to any open batch; no batch_slot-based split
DROP POLICY IF EXISTS offering_week_batches_insert ON public.offering_week_batches;

CREATE POLICY offering_week_batches_insert ON public.offering_week_batches FOR INSERT
WITH CHECK (
  org_id = public.current_org_id ()
  AND (
    public.user_is_admin ()
    OR public.user_has_role_key ('committee_head')
    OR public.user_has_role_key ('church_elder')
    OR public.user_is_treasurer ()
  )
);

DROP POLICY IF EXISTS offerings_insert_weekly_roles ON public.offerings;

CREATE POLICY offerings_insert_weekly_roles ON public.offerings FOR INSERT
WITH CHECK (
  org_id = public.current_org_id ()
  AND batch_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.offering_week_batches b
    WHERE b.id = offerings.batch_id
      AND b.org_id = public.current_org_id ()
      AND b.status::text IN ('pending_authorization', 'rejected')
      AND (
        public.user_is_admin ()
        OR public.user_has_role_key ('committee_head')
        OR public.user_has_role_key ('church_elder')
        OR public.user_is_treasurer ()
      )
  )
);

DROP POLICY IF EXISTS offerings_update_weekly_roles ON public.offerings;

CREATE POLICY offerings_update_weekly_roles ON public.offerings FOR
UPDATE
  USING (
    org_id = public.current_org_id ()
    AND batch_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.offering_week_batches b
      WHERE b.id = offerings.batch_id
        AND b.org_id = public.current_org_id ()
        AND b.status::text IN ('pending_authorization', 'rejected')
        AND (
          public.user_is_admin ()
          OR public.user_has_role_key ('committee_head')
          OR public.user_has_role_key ('church_elder')
          OR public.user_is_treasurer ()
        )
    )
  )
WITH CHECK (
  org_id = public.current_org_id ()
  AND batch_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.offering_week_batches b
    WHERE b.id = offerings.batch_id
      AND b.org_id = public.current_org_id ()
      AND b.status::text IN ('pending_authorization', 'rejected')
      AND (
        public.user_is_admin ()
        OR public.user_has_role_key ('committee_head')
        OR public.user_has_role_key ('church_elder')
        OR public.user_is_treasurer ()
      )
  )
);
