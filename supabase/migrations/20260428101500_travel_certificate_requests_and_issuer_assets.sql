-- Travel certificate enhancements:
-- - self/dependent/manual request flow
-- - issuer-specific signature and stamp
-- - communion + dependant details

CREATE TABLE IF NOT EXISTS public.certificate_issuer_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  signature_url text,
  stamp_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

ALTER TABLE public.travel_certificates
ADD COLUMN IF NOT EXISTS request_kind text NOT NULL DEFAULT 'manual'
  CHECK (request_kind IN ('self', 'dependent', 'manual')),
ADD COLUMN IF NOT EXISTS dependent_name text,
ADD COLUMN IF NOT EXISTS dependent_age text,
ADD COLUMN IF NOT EXISTS dependent_contacts text,
ADD COLUMN IF NOT EXISTS takes_holy_communion boolean;

DROP TRIGGER IF EXISTS trg_certificate_issuer_assets_touch ON public.certificate_issuer_assets;
CREATE TRIGGER trg_certificate_issuer_assets_touch
BEFORE UPDATE ON public.certificate_issuer_assets
FOR EACH ROW
EXECUTE PROCEDURE public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.can_issue_travel_certificate()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.user_has_role_key('pastor')
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
  v_issuer_name text;
BEGIN
  SELECT public.can_issue_travel_certificate() INTO v_can_issue;

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

  SELECT next_certificate_number
  INTO v_next_number
  FROM public.org_certificate_settings
  WHERE org_id = v_org_id
  FOR UPDATE;

  SELECT
    COALESCE(NULLIF(cia.signature_url, ''), ocs.pastor_signature_url),
    COALESCE(NULLIF(cia.stamp_url, ''), ocs.pastor_stamp_url),
    p.full_name
  INTO v_signature, v_stamp, v_issuer_name
  FROM public.org_certificate_settings ocs
  LEFT JOIN public.certificate_issuer_assets cia
    ON cia.org_id = ocs.org_id
   AND cia.user_id = auth.uid()
  LEFT JOIN public.profiles p
    ON p.id = auth.uid()
  WHERE ocs.org_id = v_org_id;

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
    pastor_stamp_url = COALESCE(NULLIF(v_stamp, ''), pastor_stamp_url),
    signer_name = COALESCE(NULLIF(v_issuer_name, ''), signer_name),
    reject_reason = NULL
  WHERE id = _certificate_id;

  RETURN QUERY
  SELECT id, certificate_number
  FROM public.travel_certificates
  WHERE id = _certificate_id;
END;
$$;

ALTER TABLE public.certificate_issuer_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS certificate_issuer_assets_select ON public.certificate_issuer_assets;
CREATE POLICY certificate_issuer_assets_select ON public.certificate_issuer_assets
FOR SELECT
USING (
  user_id = auth.uid()
  OR (org_id = public.current_org_id() AND public.can_manage_travel_certificate())
);

DROP POLICY IF EXISTS certificate_issuer_assets_write ON public.certificate_issuer_assets;
CREATE POLICY certificate_issuer_assets_write ON public.certificate_issuer_assets
FOR ALL
USING (
  org_id = public.current_org_id()
  AND user_id = auth.uid()
  AND public.can_issue_travel_certificate()
)
WITH CHECK (
  org_id = public.current_org_id()
  AND user_id = auth.uid()
  AND public.can_issue_travel_certificate()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificate_issuer_assets TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_issue_travel_certificate() TO authenticated;
