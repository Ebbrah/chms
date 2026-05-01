-- ChMS initial schema: enums, tables, RLS, triggers

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'treasurer', 'pastor', 'member');
CREATE TYPE public.budget_status AS ENUM ('draft', 'approved');
CREATE TYPE public.account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE public.journal_source_type AS ENUM ('manual', 'offering', 'cashbook', 'payroll', 'system');
CREATE TYPE public.cashbook_direction AS ENUM ('in', 'out');
CREATE TYPE public.payroll_run_status AS ENUM ('draft', 'posted');
CREATE TYPE public.sms_status AS ENUM ('queued', 'sent', 'failed');

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  full_name text,
  phone text,
  avatar_url text,
  preferences jsonb NOT NULL DEFAULT '{}',
  sms_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id, role)
);

CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  household_id uuid REFERENCES public.households (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  join_date date,
  email text,
  phone text,
  address text,
  notes text,
  pastoral_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.offering_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members (id) ON DELETE SET NULL,
  offering_type_id uuid NOT NULL REFERENCES public.offering_types (id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'USD',
  received_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  payment_method text,
  reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fiscal_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  label text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, label)
);

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type public.account_type NOT NULL,
  parent_id uuid REFERENCES public.accounts (id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  fiscal_year_id uuid NOT NULL REFERENCES public.fiscal_years (id) ON DELETE CASCADE,
  name text NOT NULL,
  status public.budget_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL,
  notes text,
  UNIQUE (budget_id, account_id)
);

CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  description text,
  source_type public.journal_source_type NOT NULL DEFAULT 'manual',
  source_id uuid,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  posted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE RESTRICT,
  debit numeric(14, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo text,
  CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0) OR (debit = 0 AND credit = 0)
  )
);

CREATE TABLE public.cashbook_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE RESTRICT,
  opening_balance numeric(14, 2) NOT NULL DEFAULT 0,
  as_of_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cashbook_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  cashbook_account_id uuid NOT NULL REFERENCES public.cashbook_accounts (id) ON DELETE CASCADE,
  txn_date date NOT NULL,
  amount numeric(14, 2) NOT NULL CHECK (amount >= 0),
  direction public.cashbook_direction NOT NULL,
  payee_payor text,
  category text,
  memo text,
  journal_entry_id uuid REFERENCES public.journal_entries (id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members (id) ON DELETE SET NULL,
  name text NOT NULL,
  role_title text,
  compensation_type text NOT NULL DEFAULT 'salary',
  base_amount numeric(14, 2),
  tax_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status public.payroll_run_status NOT NULL DEFAULT 'draft',
  journal_entry_id uuid REFERENCES public.journal_entries (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payroll_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE RESTRICT,
  gross numeric(14, 2) NOT NULL DEFAULT 0,
  deductions jsonb NOT NULL DEFAULT '[]',
  net numeric(14, 2) NOT NULL DEFAULT 0,
  notes text
);

CREATE TABLE public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  to_phone text NOT NULL,
  body text NOT NULL,
  status public.sms_status NOT NULL DEFAULT 'queued',
  provider_id text,
  error text,
  sent_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  old_row jsonb,
  new_row jsonb,
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_profiles_org ON public.profiles (org_id);
CREATE INDEX idx_user_roles_user ON public.user_roles (user_id);
CREATE INDEX idx_members_org ON public.members (org_id);
CREATE INDEX idx_members_user ON public.members (user_id);
CREATE INDEX idx_offerings_org_date ON public.offerings (org_id, received_at);
CREATE INDEX idx_journal_entries_org_date ON public.journal_entries (org_id, entry_date);
CREATE INDEX idx_journal_lines_entry ON public.journal_lines (journal_entry_id);
CREATE INDEX idx_cashbook_txn_account ON public.cashbook_transactions (cashbook_account_id, txn_date);

-- Default org for new signups
INSERT INTO public.organizations (id, name, settings)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Default Church',
  '{}'::jsonb
);

-- Helper functions (SECURITY DEFINER for RLS)
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.user_has_any_role(_roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = ANY (_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_any_role (ARRAY['admin']::public.app_role[])
$$;

CREATE OR REPLACE FUNCTION public.can_finance()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_any_role (ARRAY['admin', 'treasurer']::public.app_role[])
$$;

CREATE OR REPLACE FUNCTION public.can_pastoral()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_any_role (
    ARRAY['admin', 'treasurer', 'pastor']::public.app_role[]
  )
$$;

-- New user → profile + default member role
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
  INSERT INTO public.profiles (id, org_id, full_name)
  VALUES (NEW.id, org, disp);
  INSERT INTO public.user_roles (user_id, org_id, role)
  VALUES (NEW.id, org, 'member');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- Journal lines must balance (deferred)
CREATE OR REPLACE FUNCTION public.journal_entry_must_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  jid uuid;
  tdebit numeric;
  tcredit numeric;
BEGIN
  jid := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO tdebit, tcredit
  FROM public.journal_lines
  WHERE journal_entry_id = jid;
  IF tdebit <> tcredit THEN
    RAISE EXCEPTION 'Journal entry % is not balanced (debits % credits %)', jid, tdebit, tcredit;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_journal_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE PROCEDURE public.journal_entry_must_balance();

-- RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offering_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbook_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbook_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- organizations: users in org can read
CREATE POLICY org_select ON public.organizations FOR
SELECT
  USING (id = public.current_org_id ());

-- profiles
CREATE POLICY profiles_select ON public.profiles FOR
SELECT
  USING (
    id = auth.uid ()
    OR (
      org_id = public.current_org_id ()
      AND public.can_pastoral ()
    )
  );

CREATE POLICY profiles_update_self ON public.profiles FOR
UPDATE
  USING (id = auth.uid ())
  WITH CHECK (id = auth.uid ());

CREATE POLICY profiles_update_admin ON public.profiles FOR
UPDATE
  USING (
    org_id = public.current_org_id ()
    AND public.user_is_admin ()
  )
  WITH CHECK (
    org_id = public.current_org_id ()
    AND public.user_is_admin ()
  );

-- user_roles
CREATE POLICY user_roles_select ON public.user_roles FOR
SELECT
  USING (
    user_id = auth.uid ()
    OR (
      org_id = public.current_org_id ()
      AND public.user_is_admin ()
    )
  );

CREATE POLICY user_roles_mutate_admin ON public.user_roles FOR ALL USING (
  org_id = public.current_org_id ()
  AND public.user_is_admin ()
)
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.user_is_admin ()
);

-- households
CREATE POLICY households_select ON public.households FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND public.can_pastoral ()
  );

CREATE POLICY households_write ON public.households FOR ALL USING (
  org_id = public.current_org_id ()
  AND public.user_has_any_role (ARRAY['admin', 'treasurer', 'pastor']::public.app_role[])
)
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.user_has_any_role (ARRAY['admin', 'treasurer', 'pastor']::public.app_role[])
);

-- members
CREATE POLICY members_select ON public.members FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND (
      public.can_pastoral ()
      OR EXISTS (
        SELECT 1
        FROM public.members m
        WHERE m.id = members.id
          AND m.user_id = auth.uid ()
      )
    )
  );

CREATE POLICY members_insert ON public.members FOR INSERT
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.user_has_any_role (ARRAY['admin', 'treasurer', 'pastor']::public.app_role[])
);

CREATE POLICY members_update ON public.members FOR
UPDATE
  USING (
    org_id = public.current_org_id ()
    AND (
      public.user_has_any_role (ARRAY['admin', 'treasurer']::public.app_role[])
      OR (
        public.user_has_any_role (ARRAY['pastor']::public.app_role[])
        AND org_id = public.current_org_id ()
      )
      OR user_id = auth.uid ()
    )
  );

CREATE POLICY members_delete ON public.members FOR DELETE USING (
  org_id = public.current_org_id ()
  AND public.user_has_any_role (ARRAY['admin', 'treasurer']::public.app_role[])
);

-- offering types (read: anyone in org; write: finance)
CREATE POLICY offering_types_select ON public.offering_types FOR
SELECT
  USING (org_id = public.current_org_id ());

CREATE POLICY offering_types_write ON public.offering_types FOR ALL USING (
  org_id = public.current_org_id ()
  AND public.can_finance ()
)
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.can_finance ()
);

-- offerings
CREATE POLICY offerings_select ON public.offerings FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND (
      public.can_finance ()
      OR public.user_has_any_role (ARRAY['pastor']::public.app_role[])
      OR EXISTS (
        SELECT 1
        FROM public.members m
        WHERE m.id = offerings.member_id
          AND m.user_id = auth.uid ()
      )
    )
  );

CREATE POLICY offerings_write ON public.offerings FOR ALL USING (
  org_id = public.current_org_id ()
  AND public.can_finance ()
)
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.can_finance ()
);

-- fiscal years, accounts, budgets, budget_lines, journal*, cashbook*, employees, payroll*
CREATE POLICY finance_select ON public.fiscal_years FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND public.can_finance ()
  );

CREATE POLICY finance_fy_write ON public.fiscal_years FOR ALL USING (
  org_id = public.current_org_id ()
  AND public.can_finance ()
)
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.can_finance ()
);

CREATE POLICY finance_accounts_select ON public.accounts FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND public.can_finance ()
  );

CREATE POLICY finance_accounts_write ON public.accounts FOR ALL USING (
  org_id = public.current_org_id ()
  AND public.can_finance ()
)
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.can_finance ()
);

CREATE POLICY finance_budgets ON public.budgets FOR ALL USING (
  org_id = public.current_org_id ()
  AND public.can_finance ()
)
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.can_finance ()
);

CREATE POLICY finance_budget_lines ON public.budget_lines FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM public.budgets b
    WHERE b.id = budget_lines.budget_id
      AND b.org_id = public.current_org_id ()
      AND public.can_finance ()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.budgets b
    WHERE b.id = budget_lines.budget_id
      AND b.org_id = public.current_org_id ()
      AND public.can_finance ()
  )
);

CREATE POLICY finance_journal_entries ON public.journal_entries FOR ALL USING (
  org_id = public.current_org_id ()
  AND public.can_finance ()
)
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.can_finance ()
);

CREATE POLICY finance_journal_lines ON public.journal_lines FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM public.journal_entries j
    WHERE j.id = journal_lines.journal_entry_id
      AND j.org_id = public.current_org_id ()
      AND public.can_finance ()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.journal_entries j
    WHERE j.id = journal_lines.journal_entry_id
      AND j.org_id = public.current_org_id ()
      AND public.can_finance ()
  )
);

CREATE POLICY finance_cashbook_accounts ON public.cashbook_accounts FOR ALL USING (
  org_id = public.current_org_id ()
  AND public.can_finance ()
)
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.can_finance ()
);

CREATE POLICY finance_cashbook_txn ON public.cashbook_transactions FOR ALL USING (
  org_id = public.current_org_id ()
  AND public.can_finance ()
)
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.can_finance ()
);

CREATE POLICY finance_employees ON public.employees FOR ALL USING (
  org_id = public.current_org_id ()
  AND public.can_finance ()
)
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.can_finance ()
);

CREATE POLICY finance_payroll_runs ON public.payroll_runs FOR ALL USING (
  org_id = public.current_org_id ()
  AND public.can_finance ()
)
WITH CHECK (
  org_id = public.current_org_id ()
  AND public.can_finance ()
);

CREATE POLICY finance_payroll_lines ON public.payroll_lines FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM public.payroll_runs pr
    WHERE pr.id = payroll_lines.payroll_run_id
      AND pr.org_id = public.current_org_id ()
      AND public.can_finance ()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.payroll_runs pr
    WHERE pr.id = payroll_lines.payroll_run_id
      AND pr.org_id = public.current_org_id ()
      AND public.can_finance ()
  )
);

-- SMS: finance + admin
CREATE POLICY sms_select ON public.sms_messages FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND (
      public.can_finance ()
      OR public.user_is_admin ()
    )
  );

CREATE POLICY sms_insert ON public.sms_messages FOR INSERT
WITH CHECK (
  org_id = public.current_org_id ()
  AND (
    public.can_finance ()
    OR public.user_is_admin ()
  )
);

-- audit: admin read; insert via service role typically
CREATE POLICY audit_select ON public.audit_log FOR
SELECT
  USING (
    org_id = public.current_org_id ()
    AND public.user_is_admin ()
  );

-- Grants (Supabase: RLS still applies for authenticated)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
