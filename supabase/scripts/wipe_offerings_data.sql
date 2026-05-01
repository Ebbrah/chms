-- =============================================================================
-- HOW TO RUN THIS (read this first)
-- =============================================================================
-- Supabase SQL Editor only accepts SQL text. It cannot open files from your PC.
--
--   WRONG:  supabase/scripts/wipe_offerings_data.sql   (this is a path, not SQL)
--   RIGHT:  Open this file in your editor, select everything from BEGIN; down to
--            COMMIT; inclusive, copy it, paste into SQL Editor, then click Run.
--
-- Or from your project folder in a terminal (if Supabase CLI is linked):
--   supabase db execute --file supabase/scripts/wipe_offerings_data.sql
-- =============================================================================
-- WIPE ALL RECORDED OFFERINGS (practice / dry run reset)
-- =============================================================================
-- Removes:
--   - all rows in `offerings`
--   - all rows in `member_other_pledges`
--   - journal entries tied to offering batches (lines removed via ON DELETE CASCADE)
--   - all rows in `offering_week_batches`
--
-- Does NOT delete: members, offering_types, accounts, or unrelated ledger rows.
--
-- Run in Supabase Dashboard → SQL Editor (runs as postgres; bypasses RLS).
-- =============================================================================

BEGIN;

DELETE FROM public.offerings;

DELETE FROM public.member_other_pledges;

DELETE FROM public.journal_entries
WHERE
  source_type = 'offering'
  OR id IN (
    SELECT journal_entry_id
    FROM public.offering_week_batches
    WHERE journal_entry_id IS NOT NULL
  );

DELETE FROM public.offering_week_batches;

COMMIT;

-- -----------------------------------------------------------------------------
-- Single-organization only (replace with your org UUID from public.organizations):
-- -----------------------------------------------------------------------------
-- BEGIN;
-- DELETE FROM public.offerings WHERE org_id = 'YOUR-ORG-UUID'::uuid;
-- DELETE FROM public.member_other_pledges WHERE org_id = 'YOUR-ORG-UUID'::uuid;
-- DELETE FROM public.journal_entries
-- WHERE org_id = 'YOUR-ORG-UUID'::uuid
--   AND (
--     source_type = 'offering'
--     OR id IN (
--       SELECT journal_entry_id
--       FROM public.offering_week_batches
--       WHERE org_id = 'YOUR-ORG-UUID'::uuid AND journal_entry_id IS NOT NULL
--     )
--   );
-- DELETE FROM public.offering_week_batches WHERE org_id = 'YOUR-ORG-UUID'::uuid;
-- COMMIT;
