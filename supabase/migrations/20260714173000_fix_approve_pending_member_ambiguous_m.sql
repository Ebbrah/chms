-- Fix approve_pending_member_registration: record variable "m" shadowed table alias "m"
-- (PostgreSQL error: column reference "m.*" is ambiguous).

CREATE OR REPLACE FUNCTION public.approve_pending_member_registration(_member_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org uuid;
  uid uuid;
  new_num text;
  member_row public.members%ROWTYPE;
  details jsonb;
  pledge_1 numeric(14, 2);
  pledge_2 numeric(14, 2);
  pledge_3 numeric(14, 2);
BEGIN
  IF NOT public.user_has_any_role(ARRAY['admin', 'treasurer']::public.app_role[]) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT *
  INTO member_row
  FROM public.members
  WHERE id = _member_id
    AND org_id = public.current_org_id()
    AND status = 'pending_offering_number'
    AND offering_number IS NULL
  FOR UPDATE;

  IF member_row.id IS NULL THEN
    RAISE EXCEPTION 'Pending registration not found';
  END IF;

  org := member_row.org_id;
  uid := member_row.user_id;
  details := COALESCE(member_row.member_details, '{}'::jsonb);

  new_num := public.next_offering_number_for_org(org);

  UPDATE public.members
  SET
    offering_number = new_num,
    status = 'active',
    updated_at = now()
  WHERE id = _member_id;

  -- Link any offerings recorded against this number before approval.
  UPDATE public.offerings o
  SET member_id = _member_id
  WHERE o.org_id = org
    AND o.member_id IS NULL
    AND lower(btrim(COALESCE(o.offering_number_snapshot, ''))) = lower(new_num);

  -- Keep the seed file in sync: new approved members appear in member_seeds for future imports/exports.
  pledge_1 := NULLIF(regexp_replace(COALESCE(details ->> 'pledge_1', ''), '[^0-9.]', '', 'g'), '')::numeric(14, 2);
  pledge_2 := NULLIF(regexp_replace(COALESCE(details ->> 'pledge_2', ''), '[^0-9.]', '', 'g'), '')::numeric(14, 2);
  pledge_3 := NULLIF(regexp_replace(COALESCE(details ->> 'pledge_3', ''), '[^0-9.]', '', 'g'), '')::numeric(14, 2);

  INSERT INTO public.member_seeds (
    org_id,
    offering_number,
    full_name,
    gender,
    phone,
    pledge_ahadi,
    pledge_jengo,
    pledge_dayosisi,
    raw,
    updated_at
  )
  VALUES (
    org,
    new_num,
    COALESCE(NULLIF(btrim(details ->> 'full_name'), ''), (SELECT full_name FROM public.profiles WHERE id = uid), 'Member'),
    NULLIF(btrim(details ->> 'gender'), ''),
    COALESCE(NULLIF(btrim(member_row.phone), ''), (SELECT phone FROM public.profiles WHERE id = uid)),
    pledge_1,
    pledge_2,
    pledge_3,
    details,
    now()
  )
  ON CONFLICT (org_id, offering_number) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    gender = EXCLUDED.gender,
    phone = EXCLUDED.phone,
    pledge_ahadi = EXCLUDED.pledge_ahadi,
    pledge_jengo = EXCLUDED.pledge_jengo,
    pledge_dayosisi = EXCLUDED.pledge_dayosisi,
    raw = EXCLUDED.raw,
    updated_at = now();

  RETURN new_num;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_pending_member_registration (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_pending_member_registration (uuid) TO authenticated, service_role;
