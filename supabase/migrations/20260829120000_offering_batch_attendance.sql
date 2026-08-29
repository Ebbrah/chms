-- Per-batch Sunday service info (leader, preacher, attendance) for offering batches 1 & 2.

ALTER TABLE public.offering_week_batches
ADD COLUMN IF NOT EXISTS service_leader text,
ADD COLUMN IF NOT EXISTS preacher text,
ADD COLUMN IF NOT EXISTS adults_attendance_count integer,
ADD COLUMN IF NOT EXISTS children_attendance_count integer;

ALTER TABLE public.offering_week_batches DROP CONSTRAINT IF EXISTS offering_week_batches_adults_attendance_nonneg;

ALTER TABLE public.offering_week_batches
ADD CONSTRAINT offering_week_batches_adults_attendance_nonneg CHECK (
  adults_attendance_count IS NULL
  OR adults_attendance_count >= 0
);

ALTER TABLE public.offering_week_batches DROP CONSTRAINT IF EXISTS offering_week_batches_children_attendance_nonneg;

ALTER TABLE public.offering_week_batches
ADD CONSTRAINT offering_week_batches_children_attendance_nonneg CHECK (
  children_attendance_count IS NULL
  OR children_attendance_count >= 0
);

COMMENT ON COLUMN public.offering_week_batches.service_leader IS 'Worship leader (Kiongozi wa Ibada) for this batch (slots 1–2).';
COMMENT ON COLUMN public.offering_week_batches.preacher IS 'Preacher (Mhubiri) for this batch (slots 1–2).';
COMMENT ON COLUMN public.offering_week_batches.adults_attendance_count IS 'Adult attendance (Mahudhurio watu wazima) for this batch (slots 1–2).';
COMMENT ON COLUMN public.offering_week_batches.children_attendance_count IS 'Children attendance (Mahudhurio watoto) for this batch (slots 1–2).';

-- Recording roles may update open batches (service info + affected_rows during weekly save).
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
