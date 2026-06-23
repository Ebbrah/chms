-- Revert MT-Phase 4: remove regional report functions, registry search, and audit table.
-- Keeps MT-1 diocese/district officer tables for future MT-4 re-implementation.

DROP FUNCTION IF EXISTS public.remove_district_officer (uuid);
DROP FUNCTION IF EXISTS public.remove_diocese_officer (uuid);
DROP FUNCTION IF EXISTS public.assign_district_officer (uuid, uuid, public.district_officer_role);
DROP FUNCTION IF EXISTS public.assign_diocese_officer (uuid, uuid, public.diocese_officer_role);
DROP FUNCTION IF EXISTS public.search_member_registry (text, uuid, text);
DROP FUNCTION IF EXISTS public.report_district_financial_by_parish (uuid, date, date);
DROP FUNCTION IF EXISTS public.report_diocese_financial_totals (uuid, date, date);
DROP FUNCTION IF EXISTS public.report_district_financial_totals (uuid, date, date);
DROP FUNCTION IF EXISTS public.report_diocese_demographics_by_parish (uuid);
DROP FUNCTION IF EXISTS public.report_district_demographics_by_parish (uuid);
DROP FUNCTION IF EXISTS public.report_diocese_demographics (uuid);
DROP FUNCTION IF EXISTS public.report_district_demographics (uuid);
DROP FUNCTION IF EXISTS public.member_demographic_row (jsonb, int, int);
DROP FUNCTION IF EXISTS public.user_can_search_registry (text, uuid);
DROP FUNCTION IF EXISTS public.user_can_view_district_finance (uuid);
DROP FUNCTION IF EXISTS public.user_can_view_diocese_finance (uuid);
DROP FUNCTION IF EXISTS public.user_can_view_district_demographics (uuid);
DROP FUNCTION IF EXISTS public.user_can_view_diocese_demographics (uuid);
DROP FUNCTION IF EXISTS public.user_is_district_officer (uuid);
DROP FUNCTION IF EXISTS public.user_is_diocese_officer (uuid);

DROP TABLE IF EXISTS public.registry_search_audit;
