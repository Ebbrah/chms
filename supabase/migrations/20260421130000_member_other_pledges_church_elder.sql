-- Align RLS with app: church_elder can record other pledges (same as weekly/collective).

CREATE POLICY member_other_pledges_select_church_elder_org ON public.member_other_pledges FOR
SELECT
USING (
  org_id = public.current_org_id ()
  AND public.user_has_role_key ('church_elder')
);

CREATE POLICY member_other_pledges_insert_church_elder_org ON public.member_other_pledges FOR INSERT
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.user_has_role_key ('church_elder')
);
