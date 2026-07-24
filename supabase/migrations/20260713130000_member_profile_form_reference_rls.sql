-- Reference data for member self-service and onboarding profile forms.
-- loadMemberEditFormData() and getHouseholdLeaderIdsForForm() need org-wide read access
-- to jumuiya assignments and leader names without finance/admin/pastoral roles.
--
-- Jumuiya dropdowns are already covered by households_select_member_org
-- (20260427220000_certificate_jina_la_usharika_household.sql).

DROP POLICY IF EXISTS user_roles_select_church_elder_directory ON public.user_roles;
CREATE POLICY user_roles_select_church_elder_directory ON public.user_roles FOR
SELECT
USING (
  org_id = public.current_org_id()
  AND public.user_has_role_key('member')
  AND role = 'church_elder'::public.app_role
);

DROP POLICY IF EXISTS profiles_select_member_form_leaders ON public.profiles;
CREATE POLICY profiles_select_member_form_leaders ON public.profiles FOR
SELECT
USING (
  org_id = public.current_org_id()
  AND public.user_has_role_key('member')
  AND (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = profiles.id
        AND ur.org_id = profiles.org_id
        AND ur.role = 'church_elder'::public.app_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.households h
      WHERE h.org_id = profiles.org_id
        AND h.chairperson_user_id = profiles.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.jumuiya_chair_assignments jca
      WHERE jca.org_id = profiles.org_id
        AND jca.user_id = profiles.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.jumuiya_elder_assignments jea
      WHERE jea.org_id = profiles.org_id
        AND jea.user_id = profiles.id
    )
  )
);

DROP POLICY IF EXISTS jumuiya_chairs_select_member_org ON public.jumuiya_chair_assignments;
CREATE POLICY jumuiya_chairs_select_member_org ON public.jumuiya_chair_assignments FOR
SELECT
USING (
  org_id = public.current_org_id()
  AND public.user_has_role_key('member')
);

DROP POLICY IF EXISTS jumuiya_elders_select_member_org ON public.jumuiya_elder_assignments;
CREATE POLICY jumuiya_elders_select_member_org ON public.jumuiya_elder_assignments FOR
SELECT
USING (
  org_id = public.current_org_id()
  AND public.user_has_role_key('member')
);
