-- Outbound WhatsApp message log (Meta Cloud API), same access pattern as sms_messages.

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  to_phone text NOT NULL,
  body text NOT NULL,
  status public.sms_status NOT NULL DEFAULT 'queued',
  provider_id text,
  error text,
  sent_at timestamptz,
  broadcast_id uuid,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_org_created
ON public.whatsapp_messages (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_broadcast
ON public.whatsapp_messages (broadcast_id)
WHERE broadcast_id IS NOT NULL;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_select ON public.whatsapp_messages FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND (
      public.can_finance ()
      OR public.user_is_admin ()
    )
  );

CREATE POLICY whatsapp_insert ON public.whatsapp_messages FOR INSERT
WITH CHECK (
  org_id = public.current_org_id ()
  AND (
    public.can_finance ()
    OR public.user_is_admin ()
  )
);

CREATE POLICY whatsapp_update ON public.whatsapp_messages FOR
UPDATE
  USING (
    org_id = public.current_org_id ()
    AND (
      public.can_finance ()
      OR public.user_is_admin ()
    )
  )
  WITH CHECK (
    org_id = public.current_org_id ()
    AND (
      public.can_finance ()
      OR public.user_is_admin ()
    )
  );
