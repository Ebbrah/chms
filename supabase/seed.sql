-- Dev seed: default org id matches migration
-- Run after migrations: psql or Supabase SQL editor

INSERT INTO public.accounts (org_id, code, name, type)
VALUES
  ('00000000-0000-4000-8000-000000000001', '1000', 'Cash on hand', 'asset'),
  ('00000000-0000-4000-8000-000000000001', '1100', 'Bank — operating', 'asset'),
  ('00000000-0000-4000-8000-000000000001', '2000', 'Accounts payable', 'liability'),
  ('00000000-0000-4000-8000-000000000001', '2100', 'Payroll withholdings payable', 'liability'),
  ('00000000-0000-4000-8000-000000000001', '3000', 'Net assets', 'equity'),
  ('00000000-0000-4000-8000-000000000001', '4000', 'Donations & offerings', 'revenue'),
  ('00000000-0000-4000-8000-000000000001', '5000', 'Salary expense', 'expense'),
  ('00000000-0000-4000-8000-000000000001', '5100', 'Miscellaneous expense', 'expense')
ON CONFLICT (org_id, code) DO NOTHING;

INSERT INTO public.fiscal_years (org_id, label, start_date, end_date)
VALUES
  (
    '00000000-0000-4000-8000-000000000001',
    'FY 2026',
    '2026-01-01',
    '2026-12-31'
  )
ON CONFLICT (org_id, label) DO NOTHING;

INSERT INTO public.offering_types (org_id, name)
SELECT '00000000-0000-4000-8000-000000000001', v
FROM (VALUES ('Tithe'), ('Thanksgiving'), ('Ahadi'), ('Jengo'), ('Maendeleo ya Dayosisi')) AS t(v)
WHERE NOT EXISTS (
  SELECT 1 FROM public.offering_types o
  WHERE o.org_id = '00000000-0000-4000-8000-000000000001' AND o.name = t.v
);
