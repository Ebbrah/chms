-- Allow all committee heads (not only planning head) to publish global notes.
CREATE OR REPLACE FUNCTION public.can_publish_global_note()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_role_key('pastor')
    OR public.user_has_role_key('committee_head')
$$;
