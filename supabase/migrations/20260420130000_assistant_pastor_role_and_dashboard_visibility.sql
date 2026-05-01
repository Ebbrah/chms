-- Add assistant pastor role and grant equivalent pastoral reads.

ALTER TYPE public.app_role
ADD VALUE IF NOT EXISTS 'assistant_pastor';

CREATE OR REPLACE FUNCTION public.can_pastoral()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.user_has_any_role(ARRAY['admin', 'treasurer', 'pastor']::public.app_role[])
    OR public.user_has_role_key('assistant_pastor');
$$;

DROP POLICY IF EXISTS user_roles_select_pastor_org ON public.user_roles;
CREATE POLICY user_roles_select_pastor_org ON public.user_roles FOR
SELECT
USING (
  org_id = public.current_org_id ()
  AND role::text IN ('pastor', 'assistant_pastor')
);

DROP POLICY IF EXISTS profiles_select_pastor_org ON public.profiles;
CREATE POLICY profiles_select_pastor_org ON public.profiles FOR
SELECT
USING (
  org_id = public.current_org_id ()
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.org_id = public.current_org_id ()
      AND ur.user_id = profiles.id
      AND ur.role::text IN ('pastor', 'assistant_pastor')
  )
);
