-- Travel certificate workflow:
-- - member request
-- - staff drafting/review
-- - pastor issue with auto certificate number + signature/stamp

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'evangelist';

CREATE TABLE IF NOT EXISTS public.org_certificate_settings (
  org_id uuid PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  church_name text NOT NULL DEFAULT 'Kanisa la Kiinjili la Kilutheri Tanzania',
  diocese_name text NOT NULL DEFAULT 'Dayosisi ya Dodoma',
  postal_box text NOT NULL DEFAULT 'P.O.Box 1682 - Dodoma',
  logo_url text,
  pastor_signature_url text,
  pastor_stamp_url text,
  next_certificate_number bigint NOT NULL DEFAULT 1 CHECK (next_certificate_number > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.travel_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  member_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  member_name text NOT NULL,
  from_congregation text NOT NULL,
  address text,
  to_congregation text NOT NULL,
  is_baptized boolean,
  is_married boolean,
  gives_tithe boolean,
  travel_purpose text,
  other_notes text,
  signer_name text,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'draft', 'issued', 'rejected')),
  certificate_number bigint,
  issued_date date,
  issued_at timestamptz,
  approved_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  pastor_signature_url text,
  pastor_stamp_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_travel_certificates_org_number_uniq
ON public.travel_certificates (org_id, certificate_number)
WHERE certificate_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_travel_certificates_org_created
ON public.travel_certificates (org_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_certificate_settings_touch ON public.org_certificate_settings;
CREATE TRIGGER trg_org_certificate_settings_touch
BEFORE UPDATE ON public.org_certificate_settings
FOR EACH ROW
EXECUTE PROCEDURE public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_travel_certificates_touch ON public.travel_certificates;
CREATE TRIGGER trg_travel_certificates_touch
BEFORE UPDATE ON public.travel_certificates
FOR EACH ROW
EXECUTE PROCEDURE public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.can_manage_travel_certificate()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.user_has_any_role(ARRAY['admin', 'treasurer', 'pastor', 'assistant_pastor']::public.app_role[])
    OR public.user_has_role_key('evangelist');
$$;

CREATE OR REPLACE FUNCTION public.issue_travel_certificate(_certificate_id uuid)
RETURNS TABLE (issued_id uuid, issued_number bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_can_issue boolean;
  v_status text;
  v_next_number bigint;
  v_signature text;
  v_stamp text;
BEGIN
  SELECT
    public.user_has_role_key('pastor') OR public.user_has_role_key('admin')
  INTO v_can_issue;

  IF NOT v_can_issue THEN
    RAISE EXCEPTION 'Unauthorized to issue certificate';
  END IF;

  SELECT org_id, status
  INTO v_org_id, v_status
  FROM public.travel_certificates
  WHERE id = _certificate_id
    AND org_id = public.current_org_id()
  FOR UPDATE;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Certificate not found';
  END IF;

  IF v_status = 'issued' THEN
    RETURN QUERY
    SELECT id, certificate_number
    FROM public.travel_certificates
    WHERE id = _certificate_id;
    RETURN;
  END IF;

  INSERT INTO public.org_certificate_settings (org_id)
  VALUES (v_org_id)
  ON CONFLICT (org_id) DO NOTHING;

  SELECT next_certificate_number, pastor_signature_url, pastor_stamp_url
  INTO v_next_number, v_signature, v_stamp
  FROM public.org_certificate_settings
  WHERE org_id = v_org_id
  FOR UPDATE;

  UPDATE public.org_certificate_settings
  SET next_certificate_number = v_next_number + 1
  WHERE org_id = v_org_id;

  UPDATE public.travel_certificates
  SET
    status = 'issued',
    certificate_number = v_next_number,
    issued_date = CURRENT_DATE,
    issued_at = now(),
    approved_by_user_id = auth.uid(),
    pastor_signature_url = COALESCE(NULLIF(v_signature, ''), pastor_signature_url),
    pastor_stamp_url = COALESCE(NULLIF(v_stamp, ''), pastor_stamp_url)
  WHERE id = _certificate_id;

  RETURN QUERY
  SELECT id, certificate_number
  FROM public.travel_certificates
  WHERE id = _certificate_id;
END;
$$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('certificate-assets', 'certificate-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS certificate_assets_select ON storage.objects;
CREATE POLICY certificate_assets_select ON storage.objects
FOR SELECT
USING (bucket_id = 'certificate-assets');

DROP POLICY IF EXISTS certificate_assets_insert ON storage.objects;
CREATE POLICY certificate_assets_insert ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'certificate-assets');

DROP POLICY IF EXISTS certificate_assets_update ON storage.objects;
CREATE POLICY certificate_assets_update ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'certificate-assets')
WITH CHECK (bucket_id = 'certificate-assets');

DROP POLICY IF EXISTS certificate_assets_delete ON storage.objects;
CREATE POLICY certificate_assets_delete ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'certificate-assets');

ALTER TABLE public.org_certificate_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_certificate_settings_select ON public.org_certificate_settings
FOR SELECT
USING (
  org_id = public.current_org_id()
  AND (
    public.can_manage_travel_certificate()
    OR public.user_has_role_key('member')
  )
);

CREATE POLICY org_certificate_settings_mutate_admin ON public.org_certificate_settings
FOR ALL
USING (
  org_id = public.current_org_id()
  AND public.user_is_admin()
)
WITH CHECK (
  org_id = public.current_org_id()
  AND public.user_is_admin()
);

CREATE POLICY travel_certificates_select ON public.travel_certificates
FOR SELECT
USING (
  org_id = public.current_org_id()
  AND (
    public.can_manage_travel_certificate()
    OR requested_by_user_id = auth.uid()
    OR member_user_id = auth.uid()
  )
);

CREATE POLICY travel_certificates_insert ON public.travel_certificates
FOR INSERT
WITH CHECK (
  org_id = public.current_org_id()
  AND (
    public.can_manage_travel_certificate()
    OR requested_by_user_id = auth.uid()
  )
);

CREATE POLICY travel_certificates_update_staff ON public.travel_certificates
FOR UPDATE
USING (
  org_id = public.current_org_id()
  AND public.can_manage_travel_certificate()
)
WITH CHECK (
  org_id = public.current_org_id()
  AND public.can_manage_travel_certificate()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_certificate_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_certificates TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_travel_certificate(uuid) TO authenticated;
