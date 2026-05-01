-- Seed import for existing member lists (Excel upload).
-- Used to prefill member records on signup and via admin "Load data".

CREATE TABLE IF NOT EXISTS public.member_seeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  offering_number text NOT NULL,
  full_name text NOT NULL,
  gender text,
  phone text,
  pledge_ahadi numeric(14, 2),
  pledge_jengo numeric(14, 2),
  pledge_dayosisi numeric(14, 2),
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, offering_number)
);

CREATE INDEX IF NOT EXISTS idx_member_seeds_org_phone ON public.member_seeds (org_id, phone);

ALTER TABLE public.member_seeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_seeds_select ON public.member_seeds FOR
SELECT
  USING (org_id = public.current_org_id () AND public.can_finance ());

CREATE POLICY member_seeds_write ON public.member_seeds FOR ALL
USING (org_id = public.current_org_id () AND public.can_finance ())
WITH CHECK (org_id = public.current_org_id () AND public.can_finance ());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_seeds TO authenticated;

