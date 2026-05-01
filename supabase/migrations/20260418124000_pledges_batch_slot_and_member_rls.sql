-- Other pledges (per-member, recorded from finance UI)
CREATE TABLE IF NOT EXISTS public.member_other_pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  pledge_date date NOT NULL,
  title text NOT NULL,
  amount numeric(14, 2) NOT NULL CHECK (amount >= 0),
  recorded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now ()
);

CREATE INDEX IF NOT EXISTS idx_member_other_pledges_member_date ON public.member_other_pledges (member_id, pledge_date DESC);

ALTER TABLE public.member_other_pledges ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_other_pledges_select_finance ON public.member_other_pledges FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND (
      public.user_is_admin ()
      OR public.user_is_treasurer ()
      OR public.user_has_role_key ('committee_head')
    )
  );

CREATE POLICY member_other_pledges_select_own_member ON public.member_other_pledges FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id = member_other_pledges.member_id
        AND m.user_id = auth.uid ()
    )
  );

CREATE POLICY member_other_pledges_insert_finance ON public.member_other_pledges FOR INSERT
WITH CHECK (
  org_id = public.current_org_id ()
  AND (
    public.user_is_admin ()
    OR public.user_is_treasurer ()
    OR public.user_has_role_key ('committee_head')
  )
);

GRANT SELECT, INSERT ON public.member_other_pledges TO authenticated;

-- Must exist before any policy references offering_week_batches.batch_slot
ALTER TABLE public.offering_week_batches
ADD COLUMN IF NOT EXISTS batch_slot smallint NOT NULL DEFAULT 1
CHECK (batch_slot IN (1, 2));

COMMENT ON COLUMN public.offering_week_batches.batch_slot IS '1 = Sunday (wiki) service batch, 2 = mid-week / collective batch';

-- Members can read their jumuiya row (chairperson, etc.)
CREATE POLICY households_select_own_member ON public.households FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.household_id = households.id
        AND m.user_id = auth.uid ()
        AND m.org_id = public.current_org_id ()
    )
  );

-- Members can see who is assigned mzee for their jumuiya
CREATE POLICY jumuiya_elders_select_same_household ON public.jumuiya_elder_assignments FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.household_id = jumuiya_elder_assignments.household_id
        AND m.user_id = auth.uid ()
        AND m.org_id = public.current_org_id ()
    )
  );

-- Members can load names/phones for their jumuiya chair and assigned elder only
CREATE POLICY profiles_select_household_leaders ON public.profiles FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND (
      EXISTS (
        SELECT 1
        FROM public.households h
        JOIN public.members m ON m.household_id = h.id
        WHERE m.user_id = auth.uid ()
          AND m.org_id = public.current_org_id ()
          AND h.chairperson_user_id = profiles.id
      )
      OR EXISTS (
        SELECT 1
        FROM public.jumuiya_elder_assignments jea
        JOIN public.members m ON m.household_id = jea.household_id
        WHERE m.user_id = auth.uid ()
          AND m.org_id = public.current_org_id ()
          AND jea.user_id = profiles.id
      )
    )
  );

DROP POLICY IF EXISTS offering_week_batches_insert ON public.offering_week_batches;

CREATE POLICY offering_week_batches_insert ON public.offering_week_batches FOR INSERT
WITH CHECK (
  org_id = public.current_org_id ()
  AND (
    public.user_is_admin ()
    OR public.user_has_role_key ('committee_head')
    OR (
      public.user_has_role_key ('church_elder')
      AND batch_slot = 1
    )
    OR (
      public.user_is_treasurer ()
      AND batch_slot = 2
    )
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
        OR (
          public.user_has_role_key ('church_elder')
          AND b.batch_slot = 1
        )
        OR (
          public.user_is_treasurer ()
          AND b.batch_slot = 2
        )
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
          OR (
            public.user_has_role_key ('church_elder')
            AND b.batch_slot = 1
          )
          OR (
            public.user_is_treasurer ()
            AND b.batch_slot = 2
          )
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
        OR (
          public.user_has_role_key ('church_elder')
          AND b.batch_slot = 1
        )
        OR (
          public.user_is_treasurer ()
          AND b.batch_slot = 2
        )
      )
  )
);
