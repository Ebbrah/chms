-- Certificate template: congregation display name + travel cert household / offering snapshot

ALTER TABLE public.org_certificate_settings
ADD COLUMN IF NOT EXISTS jina_la_usharika text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.org_certificate_settings.jina_la_usharika IS
  'Shown on member request as Usharika anaotoka; used as from_congregation default.';

ALTER TABLE public.travel_certificates
ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS offering_number text;

COMMENT ON COLUMN public.travel_certificates.offering_number IS
  'Snapshot of member offering number (Namba ya Bahasha) when requested/issued.';

-- Allow finance/pastoral staff (same as certificate managers) to edit template settings — not admin-only.
DROP POLICY IF EXISTS org_certificate_settings_mutate_admin ON public.org_certificate_settings;

CREATE POLICY org_certificate_settings_mutate_staff ON public.org_certificate_settings
FOR ALL
USING (
  org_id = public.current_org_id ()
  AND public.can_manage_travel_certificate ()
)
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.can_manage_travel_certificate ()
);

-- Members need to list Jumuiya (households) for certificate request dropdown.
DROP POLICY IF EXISTS households_select_member_org ON public.households;

CREATE POLICY households_select_member_org ON public.households FOR
SELECT
USING (
  org_id = public.current_org_id ()
  AND public.user_has_role_key ('member')
);

-- Evangelist / certificate managers may not be in can_pastoral(); still need Jumuiya list for drafts.
DROP POLICY IF EXISTS households_select_certificate_managers ON public.households;

CREATE POLICY households_select_certificate_managers ON public.households FOR
SELECT
USING (
  org_id = public.current_org_id ()
  AND public.can_manage_travel_certificate ()
);
