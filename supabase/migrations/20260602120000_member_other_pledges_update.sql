-- Allow finance roles to correct other-pledge lines while the batch is still editable.

DROP POLICY IF EXISTS member_other_pledges_update_finance ON public.member_other_pledges;

CREATE POLICY member_other_pledges_update_finance ON public.member_other_pledges FOR
UPDATE
  USING (
    org_id = public.current_org_id ()
    AND batch_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.offering_week_batches b
      WHERE b.id = member_other_pledges.batch_id
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
    WHERE b.id = member_other_pledges.batch_id
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

GRANT UPDATE ON public.member_other_pledges TO authenticated;
