-- Support recording other pledges for unregistered congregants and expose pastor contact
-- to authenticated org members on the dashboard.

ALTER TABLE public.member_other_pledges
ALTER COLUMN member_id DROP NOT NULL;

ALTER TABLE public.member_other_pledges
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS jumuiya_name text,
ADD COLUMN IF NOT EXISTS paid_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0);

ALTER TABLE public.member_other_pledges
DROP CONSTRAINT IF EXISTS member_other_pledges_member_or_name_chk;

ALTER TABLE public.member_other_pledges
ADD CONSTRAINT member_other_pledges_member_or_name_chk
CHECK (
  member_id IS NOT NULL
  OR NULLIF(BTRIM(COALESCE(full_name, '')), '') IS NOT NULL
);

DROP POLICY IF EXISTS user_roles_select_pastor_org ON public.user_roles;
CREATE POLICY user_roles_select_pastor_org ON public.user_roles FOR
SELECT
USING (
  org_id = public.current_org_id ()
  AND role = 'pastor'
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
      AND ur.role = 'pastor'
  )
);
