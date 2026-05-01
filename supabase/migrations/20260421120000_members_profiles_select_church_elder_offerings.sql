-- Church elders record offerings for the whole congregation (not limited to assigned jumuiya).
-- Member search (other pledges, weekly grid by offering number) and inserts need org-wide
-- members + profile names. When elders may use the UI (e.g. Sunday) is enforced in the app;
-- RLS here intentionally matches that workflow so lookups are not blocked by jumuiya scope.

CREATE POLICY members_select_church_elder_org ON public.members FOR
SELECT
USING (
  org_id = public.current_org_id ()
  AND public.user_has_role_key ('church_elder')
);

CREATE POLICY profiles_select_church_elder_org ON public.profiles FOR
SELECT
USING (
  org_id = public.current_org_id ()
  AND public.user_has_role_key ('church_elder')
);
