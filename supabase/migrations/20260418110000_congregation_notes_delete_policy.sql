-- Split UPDATE vs DELETE: allow pastoral staff to remove notes (moderation), not only author/admin.
DROP POLICY IF EXISTS congregation_notes_update_delete ON public.congregation_notes;

CREATE POLICY congregation_notes_update ON public.congregation_notes
FOR UPDATE
USING (
  org_id = public.current_org_id()
  AND (public.user_is_admin() OR author_user_id = auth.uid())
)
WITH CHECK (
  org_id = public.current_org_id()
  AND (public.user_is_admin() OR author_user_id = auth.uid())
  AND (
    (household_id IS NULL AND public.can_publish_global_note())
    OR public.can_publish_jumuiya_note(household_id)
  )
);

CREATE POLICY congregation_notes_delete ON public.congregation_notes
FOR DELETE
USING (
  org_id = public.current_org_id()
  AND (
    public.user_is_admin()
    OR author_user_id = auth.uid()
    OR public.can_pastoral()
  )
);
