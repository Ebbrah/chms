-- Allow capturing offerings for unregistered members by offering number,
-- then auto-link those rows when the member record is created/updated.

ALTER TABLE public.offerings
ADD COLUMN IF NOT EXISTS offering_number_snapshot text;

CREATE INDEX IF NOT EXISTS idx_offerings_org_unlinked_offering_number
ON public.offerings (org_id, offering_number_snapshot)
WHERE member_id IS NULL
  AND offering_number_snapshot IS NOT NULL;

CREATE OR REPLACE FUNCTION public.link_unassigned_offerings_to_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_offering_number text;
BEGIN
  normalized_offering_number := NULLIF(BTRIM(COALESCE(NEW.offering_number, '')), '');

  IF normalized_offering_number IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.offerings
     SET member_id = NEW.id
   WHERE org_id = NEW.org_id
     AND member_id IS NULL
     AND lower(BTRIM(COALESCE(offering_number_snapshot, ''))) = lower(normalized_offering_number);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_members_link_unassigned_offerings ON public.members;
CREATE TRIGGER trg_members_link_unassigned_offerings
AFTER INSERT OR UPDATE OF offering_number ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.link_unassigned_offerings_to_member();
