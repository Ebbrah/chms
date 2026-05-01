-- Switch offering currency default to TZS and backfill legacy rows.

ALTER TABLE public.offerings
ALTER COLUMN currency SET DEFAULT 'TZS';

UPDATE public.offerings
SET currency = 'TZS'
WHERE currency IS NULL OR currency = 'USD';

