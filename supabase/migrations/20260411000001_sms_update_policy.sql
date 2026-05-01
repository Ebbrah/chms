-- Allow finance/admin to update SMS rows after send (status / provider id)
CREATE POLICY sms_update ON public.sms_messages FOR
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
