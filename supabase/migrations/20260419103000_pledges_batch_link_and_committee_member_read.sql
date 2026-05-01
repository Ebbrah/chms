-- Committee heads can list/search members and read names (offerings + other pledges UI)
CREATE POLICY members_select_committee_org ON public.members FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND public.user_has_role_key ('committee_head')
  );

CREATE POLICY profiles_select_committee_org ON public.profiles FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND public.user_has_role_key ('committee_head')
  );

-- Tie other pledges to offering week batches (same workflow as mid-week offerings)
ALTER TABLE public.member_other_pledges
ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.offering_week_batches (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_member_other_pledges_batch_id ON public.member_other_pledges (batch_id)
WHERE
  batch_id IS NOT NULL;

COMMENT ON COLUMN public.member_other_pledges.batch_id IS 'Mid-week batch (slot 2) for the pledge week; shown on batch detail page';

-- Treasurers need to read elder↔jumuiya mapping for member profile forms and reporting
CREATE POLICY jumuiya_elders_select_finance ON public.jumuiya_elder_assignments FOR
SELECT
  USING (org_id = public.current_org_id () AND public.can_finance ());
