-- Phase 2 member module enhancements
-- - link by user_id (existing), add offering number + rich profile details
-- - restrict member management to admin/treasurer

ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS offering_number text,
ADD COLUMN IF NOT EXISTS member_details jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text;

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND p.email IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org uuid := '00000000-0000-4000-8000-000000000001';
  disp text;
BEGIN
  disp := COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1));
  INSERT INTO public.profiles (id, org_id, full_name, email)
  VALUES (NEW.id, org, disp, NEW.email);
  INSERT INTO public.user_roles (user_id, org_id, role)
  VALUES (NEW.id, org, 'member');
  RETURN NEW;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_org_offering_number_uniq
ON public.members (org_id, offering_number)
WHERE offering_number IS NOT NULL;

DROP POLICY IF EXISTS members_insert ON public.members;
CREATE POLICY members_insert ON public.members
FOR INSERT
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.user_has_any_role (ARRAY['admin', 'treasurer']::public.app_role[])
);

DROP POLICY IF EXISTS members_update ON public.members;
CREATE POLICY members_update ON public.members
FOR UPDATE
USING (
  org_id = public.current_org_id ()
  AND public.user_has_any_role (ARRAY['admin', 'treasurer']::public.app_role[])
)
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.user_has_any_role (ARRAY['admin', 'treasurer']::public.app_role[])
);

DROP POLICY IF EXISTS members_delete ON public.members;
CREATE POLICY members_delete ON public.members
FOR DELETE
USING (
  org_id = public.current_org_id ()
  AND public.user_has_any_role (ARRAY['admin', 'treasurer']::public.app_role[])
);
