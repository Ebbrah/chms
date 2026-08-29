-- Per-batch Sunday service attendance (men, women, Sunday school children) for offering batches 1 & 2.

ALTER TABLE public.offering_week_batches
ADD COLUMN IF NOT EXISTS men_attendance_count integer,
ADD COLUMN IF NOT EXISTS women_attendance_count integer,
ADD COLUMN IF NOT EXISTS sunday_school_children_count integer;

ALTER TABLE public.offering_week_batches DROP CONSTRAINT IF EXISTS offering_week_batches_men_attendance_nonneg;

ALTER TABLE public.offering_week_batches
ADD CONSTRAINT offering_week_batches_men_attendance_nonneg CHECK (
  men_attendance_count IS NULL
  OR men_attendance_count >= 0
);

ALTER TABLE public.offering_week_batches DROP CONSTRAINT IF EXISTS offering_week_batches_women_attendance_nonneg;

ALTER TABLE public.offering_week_batches
ADD CONSTRAINT offering_week_batches_women_attendance_nonneg CHECK (
  women_attendance_count IS NULL
  OR women_attendance_count >= 0
);

ALTER TABLE public.offering_week_batches DROP CONSTRAINT IF EXISTS offering_week_batches_sunday_school_children_nonneg;

ALTER TABLE public.offering_week_batches
ADD CONSTRAINT offering_week_batches_sunday_school_children_nonneg CHECK (
  sunday_school_children_count IS NULL
  OR sunday_school_children_count >= 0
);

COMMENT ON COLUMN public.offering_week_batches.men_attendance_count IS 'Men who attended the Sunday service for this batch (slots 1–2).';
COMMENT ON COLUMN public.offering_week_batches.women_attendance_count IS 'Women who attended the Sunday service for this batch (slots 1–2).';
COMMENT ON COLUMN public.offering_week_batches.sunday_school_children_count IS 'Total children who attended Sunday school for this batch (slots 1–2).';

-- Recording roles may update open batches (attendance + affected_rows during weekly save).
CREATE POLICY offering_week_batches_update_recording_roles ON public.offering_week_batches FOR
UPDATE
  USING (
    org_id = public.current_org_id ()
    AND status::text IN ('pending_authorization', 'rejected')
    AND (
      public.user_is_admin ()
      OR public.user_has_role_key ('committee_head')
      OR public.user_has_role_key ('church_elder')
      OR public.user_is_treasurer ()
    )
  )
WITH CHECK (
    org_id = public.current_org_id ()
    AND status::text IN ('pending_authorization', 'rejected')
    AND (
      public.user_is_admin ()
      OR public.user_has_role_key ('committee_head')
      OR public.user_has_role_key ('church_elder')
      OR public.user_is_treasurer ()
    )
  );
