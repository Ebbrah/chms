-- Finance controls and reporting foundation:
-- 1) Month period locks
-- 2) Reversal/audit metadata on posted journals
-- 3) Opening-balance workflow tables
-- 4) Bank reconciliation v1 tables

CREATE TABLE IF NOT EXISTS public.accounting_period_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  period_month date NOT NULL,
  is_closed boolean NOT NULL DEFAULT true,
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  close_reason text,
  reopened_at timestamptz,
  reopened_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reopen_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, period_month),
  CHECK (date_trunc('month', period_month)::date = period_month)
);

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS posted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reversal_of_entry_id uuid REFERENCES public.journal_entries (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reversed_by_entry_id uuid REFERENCES public.journal_entries (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reversal_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_reversal_of_unique
ON public.journal_entries (reversal_of_entry_id)
WHERE reversal_of_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_journal_entries_reversed_by_entry
ON public.journal_entries (reversed_by_entry_id);

ALTER TABLE public.cashbook_transactions
  ADD COLUMN IF NOT EXISTS posting_account_id uuid REFERENCES public.accounts (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS posted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.opening_balance_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  fiscal_year_id uuid REFERENCES public.fiscal_years (id) ON DELETE SET NULL,
  period_month date NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  note text,
  posted_journal_entry_id uuid REFERENCES public.journal_entries (id) ON DELETE SET NULL,
  superseded_by_batch_id uuid REFERENCES public.opening_balance_batches (id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  posted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (date_trunc('month', period_month)::date = period_month),
  CHECK (status IN ('draft', 'posted', 'superseded')),
  UNIQUE (org_id, period_month, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_opening_balance_batches_one_active
ON public.opening_balance_batches (org_id, period_month)
WHERE status IN ('draft', 'posted');

CREATE TABLE IF NOT EXISTS public.opening_balance_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.opening_balance_batches (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE RESTRICT,
  debit numeric(14, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  cashbook_account_id uuid NOT NULL REFERENCES public.cashbook_accounts (id) ON DELETE CASCADE,
  statement_date date NOT NULL,
  description text,
  reference text,
  amount numeric(14, 2) NOT NULL,
  direction public.cashbook_direction NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  imported_batch_key text,
  matched_at timestamptz,
  matched_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_reconciliation_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  statement_line_id uuid NOT NULL REFERENCES public.bank_statement_lines (id) ON DELETE CASCADE,
  cashbook_transaction_id uuid NOT NULL REFERENCES public.cashbook_transactions (id) ON DELETE CASCADE,
  matched_amount numeric(14, 2) NOT NULL CHECK (matched_amount > 0),
  note text,
  matched_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  matched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (statement_line_id, cashbook_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_period_locks_org_month
ON public.accounting_period_locks (org_id, period_month);

CREATE INDEX IF NOT EXISTS idx_opening_balance_batch_org_month
ON public.opening_balance_batches (org_id, period_month);

CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_org_date
ON public.bank_statement_lines (org_id, statement_date);

CREATE INDEX IF NOT EXISTS idx_bank_rec_matches_org
ON public.bank_reconciliation_matches (org_id);

ALTER TABLE public.accounting_period_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opening_balance_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opening_balance_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliation_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY finance_period_locks ON public.accounting_period_locks FOR ALL USING (
  org_id = public.current_org_id() AND public.can_finance()
)
WITH CHECK (
  org_id = public.current_org_id() AND public.can_finance()
);

CREATE POLICY finance_opening_balance_batches ON public.opening_balance_batches FOR ALL USING (
  org_id = public.current_org_id() AND public.can_finance()
)
WITH CHECK (
  org_id = public.current_org_id() AND public.can_finance()
);

CREATE POLICY finance_opening_balance_lines ON public.opening_balance_lines FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM public.opening_balance_batches b
    WHERE b.id = opening_balance_lines.batch_id
      AND b.org_id = public.current_org_id()
      AND public.can_finance()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.opening_balance_batches b
    WHERE b.id = opening_balance_lines.batch_id
      AND b.org_id = public.current_org_id()
      AND public.can_finance()
  )
);

CREATE POLICY finance_bank_statement_lines ON public.bank_statement_lines FOR ALL USING (
  org_id = public.current_org_id() AND public.can_finance()
)
WITH CHECK (
  org_id = public.current_org_id() AND public.can_finance()
);

CREATE POLICY finance_bank_rec_matches ON public.bank_reconciliation_matches FOR ALL USING (
  org_id = public.current_org_id() AND public.can_finance()
)
WITH CHECK (
  org_id = public.current_org_id() AND public.can_finance()
);
