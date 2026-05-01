"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertBalancedLines } from "@/lib/finance/ledger";

function monthStart(dateLike: string) {
  const raw = String(dateLike || "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

async function orgContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, org_id: null as string | null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  return { supabase, user, org_id: profile?.org_id ?? null };
}

async function assertPeriodOpen(org_id: string, effectiveDate: string) {
  const supabase = await createClient();
  const period_month = monthStart(effectiveDate);
  if (!period_month) return { error: "Invalid posting date" } as const;
  const { data: lock, error } = await supabase
    .from("accounting_period_locks")
    .select("is_closed")
    .eq("org_id", org_id)
    .eq("period_month", period_month)
    .maybeSingle();
  if (error) return { error: error.message } as const;
  if (lock?.is_closed) {
    return { error: `Period ${period_month.slice(0, 7)} is locked. Reopen it before posting.` } as const;
  }
  return { ok: true as const, period_month };
}

export async function createAccount(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };

  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "expense");
  if (!code || !name) return { error: "Code and name required" };

  const { error } = await supabase.from("accounts").insert({
    org_id,
    code,
    name,
    type: type as "asset" | "liability" | "equity" | "revenue" | "expense",
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/accounts");
  return { ok: true };
}

export async function updateAccount(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };

  const id = String(formData.get("id") || "").trim();
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "").trim();
  const is_active = String(formData.get("is_active") || "").trim();
  if (!id || !code || !name) return { error: "Invalid account" };

  const allowed = new Set(["asset", "liability", "equity", "revenue", "expense"]);
  if (!allowed.has(type)) return { error: "Invalid account type" };
  const active = is_active === "true" || is_active === "1" || is_active === "yes";

  const { error } = await supabase
    .from("accounts")
    .update({
      code,
      name,
      type: type as "asset" | "liability" | "equity" | "revenue" | "expense",
      is_active: active,
    })
    .eq("org_id", org_id)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/accounts");
  return { ok: true };
}

export async function deleteAccount(accountId: string) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };
  const id = String(accountId || "").trim();
  if (!id) return { error: "Missing account id" };

  const { count: journalCount } = await supabase
    .from("journal_lines")
    .select("id", { count: "exact", head: true })
    .eq("account_id", id);
  if (Number(journalCount ?? 0) > 0) {
    return { error: "Cannot delete an account that is used in journal entries" };
  }

  const { count: budgetCount } = await supabase
    .from("budget_lines")
    .select("id", { count: "exact", head: true })
    .eq("account_id", id);
  if (Number(budgetCount ?? 0) > 0) {
    return { error: "Cannot delete an account that is used in budgets" };
  }

  const { count: cashbookCount } = await supabase
    .from("cashbook_accounts")
    .select("id", { count: "exact", head: true })
    .eq("account_id", id);
  if (Number(cashbookCount ?? 0) > 0) {
    return { error: "Cannot delete an account linked to a cashbook register" };
  }

  const { error } = await supabase.from("accounts").delete().eq("org_id", org_id).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/accounts");
  return { ok: true };
}

export async function createFiscalYear(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };

  const label = String(formData.get("label") || "").trim();
  const start_date = String(formData.get("start_date") || "");
  const end_date = String(formData.get("end_date") || "");
  if (!label || !start_date || !end_date) return { error: "All fields required" };

  const { error } = await supabase.from("fiscal_years").insert({
    org_id,
    label,
    start_date,
    end_date,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/fiscal-years");
  return { ok: true };
}

export async function createBudget(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };

  const fiscal_year_id = String(formData.get("fiscal_year_id") || "");
  const name = String(formData.get("name") || "").trim();
  const committee_id = String(formData.get("committee_id") || "").trim() || null;
  if (!fiscal_year_id || !name) return { error: "Invalid budget" };

  const { error } = await supabase.from("budgets").insert({
    org_id,
    fiscal_year_id,
    name,
    committee_id,
    status: "draft",
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/budget");
  return { ok: true };
}

export async function createPlanningPriority(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Kipaumbele is required" };

  const { error } = await supabase.from("planning_priorities").insert({
    org_id,
    name,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/budget");
  return { ok: true };
}

export async function createPlanningGoal(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };
  const priority_id = String(formData.get("priority_id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!priority_id || !name) return { error: "Lengo and Kipaumbele are required" };

  const { error } = await supabase.from("planning_goals").insert({
    org_id,
    priority_id,
    name,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/budget");
  return { ok: true };
}

export async function createPlanningTarget(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };
  const goal_id = String(formData.get("goal_id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const indicator = String(formData.get("indicator") || "").trim() || null;
  const expected_result = String(formData.get("expected_result") || "").trim() || null;
  if (!goal_id || !name) return { error: "Shabaha and Lengo are required" };

  const { error } = await supabase.from("planning_targets").insert({
    org_id,
    goal_id,
    name,
    indicator,
    expected_result,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/budget");
  return { ok: true };
}

export async function updateBudget(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const committee_id = String(formData.get("committee_id") || "").trim() || null;
  if (!id || !name) return { error: "Invalid budget" };

  const { error } = await supabase
    .from("budgets")
    .update({ name, committee_id })
    .eq("org_id", org_id)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/budget");
  return { ok: true };
}

export async function deleteBudget(budgetId: string) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };
  const id = String(budgetId || "").trim();
  if (!id) return { error: "Missing budget id" };

  const { data: budget, error: bErr } = await supabase
    .from("budgets")
    .select("status")
    .eq("org_id", org_id)
    .eq("id", id)
    .maybeSingle();
  if (bErr) return { error: bErr.message };
  if (!budget) return { error: "Budget not found" };
  if (String(budget.status ?? "") === "approved") {
    return { error: "Cannot delete an approved budget" };
  }

  const { count: lineCount } = await supabase
    .from("budget_lines")
    .select("id", { count: "exact", head: true })
    .eq("budget_id", id);
  if (Number(lineCount ?? 0) > 0) {
    return { error: "Cannot delete a budget that has budget lines" };
  }

  const { error } = await supabase.from("budgets").delete().eq("org_id", org_id).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/budget");
  return { ok: true };
}

export async function addBudgetLine(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };

  const budget_id = String(formData.get("budget_id") || "");
  const account_id = String(formData.get("account_id") || "");
  const amount = Number(formData.get("amount"));
  const target_id = String(formData.get("target_id") ?? "").trim() || null;
  const indicators = String(formData.get("indicators") ?? "").trim() || null;
  const results = String(formData.get("results") ?? "").trim() || null;
  const timeframe_start = String(formData.get("timeframe_start") ?? "").trim() || null;
  const timeframe_end = String(formData.get("timeframe_end") ?? "").trim() || null;
  const mhusika = String(formData.get("mhusika") ?? "").trim() || null;
  if (!budget_id || !account_id || Number.isNaN(amount)) {
    return { error: "Invalid line" };
  }
  if (amount < 0) return { error: "Amount must be zero or greater" };
  if (timeframe_start && timeframe_end && timeframe_end < timeframe_start) {
    return { error: "Time frame end must be on or after time frame start" };
  }

  if (target_id) {
    const { data: target, error: targetErr } = await supabase
      .from("planning_targets")
      .select("id, org_id")
      .eq("id", target_id)
      .eq("org_id", org_id)
      .maybeSingle();
    if (targetErr) return { error: targetErr.message };
    if (!target) return { error: "Invalid Shabaha selected" };
  }

  // Ensure the selected budget belongs to current org and can still be edited.
  const { data: budget, error: bErr } = await supabase
    .from("budgets")
    .select("id, status, org_id")
    .eq("id", budget_id)
    .eq("org_id", org_id)
    .maybeSingle();
  if (bErr) return { error: bErr.message };
  if (!budget) return { error: "Budget not found" };
  if (String(budget.status ?? "") === "approved") {
    return { error: "Cannot add or update lines on an approved budget" };
  }

  // Deterministic save flow: update existing line for (budget, account), else insert new one.
  const { data: existing, error: existingErr } = await supabase
    .from("budget_lines")
    .select("id")
    .eq("budget_id", budget_id)
    .eq("account_id", account_id)
    .maybeSingle();
  if (existingErr) return { error: existingErr.message };

  if (existing?.id) {
    const { error } = await supabase
      .from("budget_lines")
      .update({
        amount,
        target_id,
        indicators,
        results,
        timeframe_start,
        timeframe_end,
        mhusika,
      })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("budget_lines").insert({
      budget_id,
      account_id,
      amount,
      target_id,
      indicators,
      results,
      timeframe_start,
      timeframe_end,
      mhusika,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/finance/budget");
  revalidatePath("/dashboard/finance/budget/report");
  return { ok: true };
}

export async function updateBudgetLine(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };

  const id = String(formData.get("id") || "").trim();
  const amount = Number(formData.get("amount"));
  if (!id || Number.isNaN(amount) || amount < 0) return { error: "Invalid line" };

  // Prevent editing lines on approved budgets.
  const { data: line, error: lErr } = await supabase
    .from("budget_lines")
    .select("id, budget_id, budgets(status)")
    .eq("id", id)
    .maybeSingle();
  if (lErr) return { error: lErr.message };
  if (!line) return { error: "Line not found" };
  const b = line.budgets as { status?: string } | { status?: string }[] | null;
  const status = String((Array.isArray(b) ? b[0]?.status : b?.status) ?? "");
  if (status === "approved") return { error: "Cannot edit lines on an approved budget" };

  const { error } = await supabase
    .from("budget_lines")
    .update({ amount })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/budget");
  revalidatePath("/dashboard/finance/budget/report");
  return { ok: true };
}

export async function updateBudgetLineDetails(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };

  const id = String(formData.get("id") || "").trim();
  if (!id) return { error: "Missing line id" };

  const indicators = String(formData.get("indicators") ?? "").trim() || null;
  const results = String(formData.get("results") ?? "").trim() || null;
  const timeframe_start = String(formData.get("timeframe_start") ?? "").trim() || null;
  const timeframe_end = String(formData.get("timeframe_end") ?? "").trim() || null;
  const mhusika = String(formData.get("mhusika") ?? "").trim() || null;

  // Prevent editing lines on approved budgets.
  const { data: line, error: lErr } = await supabase
    .from("budget_lines")
    .select("id, budget_id, budgets(status)")
    .eq("id", id)
    .maybeSingle();
  if (lErr) return { error: lErr.message };
  if (!line) return { error: "Line not found" };
  const b = line.budgets as { status?: string } | { status?: string }[] | null;
  const status = String((Array.isArray(b) ? b[0]?.status : b?.status) ?? "");
  if (status === "approved") return { error: "Cannot edit lines on an approved budget" };

  const { error } = await supabase
    .from("budget_lines")
    .update({
      indicators,
      results,
      timeframe_start,
      timeframe_end,
      mhusika,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/budget");
  revalidatePath("/dashboard/finance/budget/report");
  return { ok: true };
}

export async function deleteBudgetLine(lineId: string) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };
  const id = String(lineId || "").trim();
  if (!id) return { error: "Missing line id" };

  const { data: line, error: lErr } = await supabase
    .from("budget_lines")
    .select("id, budgets(status)")
    .eq("id", id)
    .maybeSingle();
  if (lErr) return { error: lErr.message };
  if (!line) return { error: "Line not found" };
  const b = line.budgets as { status?: string } | { status?: string }[] | null;
  const status = String((Array.isArray(b) ? b[0]?.status : b?.status) ?? "");
  if (status === "approved") return { error: "Cannot delete lines from an approved budget" };

  const { error } = await supabase.from("budget_lines").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/budget");
  revalidatePath("/dashboard/finance/budget/report");
  return { ok: true };
}

export async function approveBudget(budgetId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("budgets")
    .update({ status: "approved" })
    .eq("id", budgetId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/budget");
  return { ok: true };
}

export async function createManualJournal(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };

  const entry_date = String(formData.get("entry_date") || "");
  const description = String(formData.get("description") || "").trim();
  const a1 = String(formData.get("account_debit") || "");
  const a2 = String(formData.get("account_credit") || "");
  const amt = Number(formData.get("amount"));
  if (!entry_date || !a1 || !a2 || Number.isNaN(amt) || amt <= 0) {
    return { error: "Invalid journal" };
  }
  const period = await assertPeriodOpen(org_id, entry_date);
  if ("error" in period) return { error: period.error };

  const lines = [
    { debit: amt, credit: 0 },
    { debit: 0, credit: amt },
  ];
  assertBalancedLines(lines);

  const { data: entry, error: e1 } = await supabase
    .from("journal_entries")
    .insert({
      org_id,
      entry_date,
      description: description || null,
      source_type: "manual",
      created_by: user.id,
      posted_by: user.id,
    })
    .select("id")
    .single();
  if (e1 || !entry) return { error: e1?.message ?? "Insert failed" };

  const { error: e2 } = await supabase.from("journal_lines").insert([
    {
      journal_entry_id: entry.id,
      account_id: a1,
      debit: amt,
      credit: 0,
    },
    {
      journal_entry_id: entry.id,
      account_id: a2,
      debit: 0,
      credit: amt,
    },
  ]);
  if (e2) return { error: e2.message };

  revalidatePath("/dashboard/finance/ledger");
  return { ok: true };
}

export async function createCashbookAccount(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };

  const name = String(formData.get("name") || "").trim();
  const account_id = String(formData.get("account_id") || "");
  const opening_balance = Number(formData.get("opening_balance") || 0);
  if (!name || !account_id) return { error: "Name and GL account required" };

  const { error } = await supabase.from("cashbook_accounts").insert({
    org_id,
    name,
    account_id,
    opening_balance,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/cashbook");
  return { ok: true };
}

export async function addCashbookTransaction(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };

  const cashbook_account_id = String(formData.get("cashbook_account_id") || "");
  const txn_date = String(formData.get("txn_date") || "");
  const amount = Number(formData.get("amount"));
  const direction = String(formData.get("direction") || "in") as "in" | "out";
  const payee_payor = String(formData.get("payee_payor") || "").trim() || null;
  const category = String(formData.get("category") || "").trim() || null;
  const memo = String(formData.get("memo") || "").trim() || null;

  if (!cashbook_account_id || !txn_date || Number.isNaN(amount) || amount < 0) {
    return { error: "Invalid transaction" };
  }
  const period = await assertPeriodOpen(org_id, txn_date);
  if ("error" in period) return { error: period.error };

  const { error } = await supabase.from("cashbook_transactions").insert({
    org_id,
    cashbook_account_id,
    txn_date,
    amount,
    direction,
    payee_payor,
    category,
    memo,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/cashbook");
  return { ok: true };
}

export async function postCashbookToLedger(
  transactionId: string,
  offsetAccountId: string,
) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };

  const { data: tx, error: e0 } = await supabase
    .from("cashbook_transactions")
    .select("*")
    .eq("id", transactionId)
    .single();
  if (e0 || !tx) return { error: e0?.message ?? "Transaction not found" };
  if (tx.journal_entry_id) return { error: "Already posted" };
  const period = await assertPeriodOpen(org_id, String(tx.txn_date));
  if ("error" in period) return { error: period.error };

  const { data: cba, error: ecb } = await supabase
    .from("cashbook_accounts")
    .select("account_id")
    .eq("id", tx.cashbook_account_id as string)
    .single();
  if (ecb || !cba?.account_id) return { error: "Cashbook account missing GL link" };
  const cashGlId = cba.account_id as string;

  const amt = Number(tx.amount);
  const lines =
    tx.direction === "in"
      ? [
          { account_id: cashGlId, debit: amt, credit: 0 },
          { account_id: offsetAccountId, debit: 0, credit: amt },
        ]
      : [
          { account_id: offsetAccountId, debit: amt, credit: 0 },
          { account_id: cashGlId, debit: 0, credit: amt },
        ];
  assertBalancedLines(lines.map((l) => ({ debit: l.debit, credit: l.credit })));

  const { data: entry, error: e1 } = await supabase
    .from("journal_entries")
    .insert({
      org_id,
      entry_date: tx.txn_date,
      description: tx.memo ?? "Cashbook",
      source_type: "cashbook",
      source_id: transactionId,
      created_by: user.id,
      posted_by: user.id,
    })
    .select("id")
    .single();
  if (e1 || !entry) return { error: e1?.message ?? "Journal failed" };

  const { error: e2 } = await supabase.from("journal_lines").insert(
    lines.map((l) => ({
      journal_entry_id: entry.id,
      account_id: l.account_id,
      debit: l.debit,
      credit: l.credit,
    })),
  );
  if (e2) return { error: e2.message };

  const { error: e3 } = await supabase
    .from("cashbook_transactions")
    .update({
      journal_entry_id: entry.id,
      posting_account_id: offsetAccountId,
      posted_at: new Date().toISOString(),
      posted_by: user.id,
    })
    .eq("id", transactionId);
  if (e3) return { error: e3.message };

  revalidatePath("/dashboard/finance/cashbook");
  revalidatePath("/dashboard/finance/ledger");
  return { ok: true };
}

export async function createEmployee(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };

  const name = String(formData.get("name") || "").trim();
  const role_title = String(formData.get("role_title") || "").trim() || null;
  const base_amount = Number(formData.get("base_amount") || 0);
  if (!name) return { error: "Name required" };

  const { error } = await supabase.from("employees").insert({
    org_id,
    name,
    role_title,
    base_amount: Number.isNaN(base_amount) ? 0 : base_amount,
    compensation_type: "salary",
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/payroll");
  return { ok: true };
}

export async function createPayrollRun(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };

  const period_start = String(formData.get("period_start") || "");
  const period_end = String(formData.get("period_end") || "");
  if (!period_start || !period_end) return { error: "Dates required" };

  const { data: run, error } = await supabase
    .from("payroll_runs")
    .insert({
      org_id,
      period_start,
      period_end,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !run) return { error: error?.message ?? "Failed" };
  revalidatePath("/dashboard/finance/payroll");
  return { ok: true, runId: run.id };
}

export async function addPayrollLine(formData: FormData) {
  const { supabase, user } = await orgContext();
  if (!user) return { error: "Unauthorized" };

  const payroll_run_id = String(formData.get("payroll_run_id") || "");
  const employee_id = String(formData.get("employee_id") || "");
  const gross = Number(formData.get("gross") || 0);
  const net = Number(formData.get("net") || 0);
  const deductionsRaw = String(formData.get("deductions_json") || "[]");
  let deductions: unknown = [];
  try {
    deductions = JSON.parse(deductionsRaw) as unknown;
  } catch {
    return { error: "Invalid deductions JSON" };
  }

  if (!payroll_run_id || !employee_id) return { error: "Missing fields" };

  const { error } = await supabase.from("payroll_lines").insert({
    payroll_run_id,
    employee_id,
    gross,
    net,
    deductions: deductions as Record<string, unknown>,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/payroll");
  return { ok: true };
}

export async function postPayrollRun(
  runId: string,
  expenseAccountId: string,
  cashAccountId: string,
  liabilityAccountId: string,
) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };

  const { data: run, error: e0 } = await supabase
    .from("payroll_runs")
    .select("*")
    .eq("id", runId)
    .single();
  if (e0 || !run) return { error: e0?.message ?? "Run not found" };
  if (run.journal_entry_id) return { error: "Already posted" };
  const period = await assertPeriodOpen(org_id, String(run.period_end));
  if ("error" in period) return { error: period.error };

  const { data: lines, error: e1 } = await supabase
    .from("payroll_lines")
    .select("*")
    .eq("payroll_run_id", runId);
  if (e1 || !lines?.length) return { error: e1?.message ?? "No lines" };

  let totalGross = 0;
  let totalNet = 0;
  for (const ln of lines) {
    totalGross += Number(ln.gross);
    totalNet += Number(ln.net);
  }

  const liabilityAmt = Math.round((totalGross - totalNet) * 100) / 100;
  const jl: { account_id: string; debit: number; credit: number }[] = [
    { account_id: expenseAccountId, debit: totalGross, credit: 0 },
    { account_id: cashAccountId, debit: 0, credit: totalNet },
  ];
  if (liabilityAmt > 0.005) {
    jl.push({
      account_id: liabilityAccountId,
      debit: 0,
      credit: liabilityAmt,
    });
  }

  assertBalancedLines(jl.map((l) => ({ debit: l.debit, credit: l.credit })));

  const { data: entry, error: e2 } = await supabase
    .from("journal_entries")
    .insert({
      org_id,
      entry_date: run.period_end,
      description: "Payroll",
      source_type: "payroll",
      source_id: runId,
      created_by: user.id,
      posted_by: user.id,
    })
    .select("id")
    .single();
  if (e2 || !entry) return { error: e2?.message ?? "Journal failed" };

  const { error: e3 } = await supabase.from("journal_lines").insert(
    jl.map((l) => ({
      journal_entry_id: entry.id,
      account_id: l.account_id,
      debit: l.debit,
      credit: l.credit,
    })),
  );
  if (e3) return { error: e3.message };

  const { error: e4 } = await supabase
    .from("payroll_runs")
    .update({ journal_entry_id: entry.id, status: "posted" })
    .eq("id", runId);
  if (e4) return { error: e4.message };

  revalidatePath("/dashboard/finance/payroll");
  revalidatePath("/dashboard/finance/ledger");
  return { ok: true };
}

export async function closeAccountingPeriod(periodMonth: string, reason?: string) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };
  const month = monthStart(periodMonth);
  if (!month) return { error: "Invalid period month" };
  const payload = {
    org_id,
    period_month: month,
    is_closed: true,
    closed_at: new Date().toISOString(),
    closed_by: user.id,
    close_reason: String(reason ?? "").trim() || null,
    reopened_at: null,
    reopened_by: null,
    reopen_reason: null,
  };
  const { error } = await supabase
    .from("accounting_period_locks")
    .upsert(payload, { onConflict: "org_id,period_month" });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/ledger");
  revalidatePath("/dashboard/finance/cashbook");
  return { ok: true };
}

export async function reopenAccountingPeriod(periodMonth: string, reason: string) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };
  const month = monthStart(periodMonth);
  if (!month) return { error: "Invalid period month" };
  const why = String(reason || "").trim();
  if (!why) return { error: "Reopen reason is required" };
  const { error } = await supabase
    .from("accounting_period_locks")
    .upsert(
      {
        org_id,
        period_month: month,
        is_closed: false,
        reopened_at: new Date().toISOString(),
        reopened_by: user.id,
        reopen_reason: why,
      },
      { onConflict: "org_id,period_month" },
    );
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/ledger");
  revalidatePath("/dashboard/finance/cashbook");
  return { ok: true };
}

export async function reverseJournalEntry(entryId: string, reason: string, reversalDate?: string) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };
  const id = String(entryId || "").trim();
  const why = String(reason || "").trim();
  if (!id) return { error: "Missing journal entry id" };
  if (!why) return { error: "Reversal reason is required" };

  const { data: original, error: e0 } = await supabase
    .from("journal_entries")
    .select("id, org_id, entry_date, description, source_type, source_id, reversed_by_entry_id")
    .eq("id", id)
    .eq("org_id", org_id)
    .maybeSingle();
  if (e0) return { error: e0.message };
  if (!original) return { error: "Journal entry not found" };
  if (original.reversed_by_entry_id) return { error: "Journal entry already reversed" };

  const reverseOn = String(reversalDate || "").trim() || String(original.entry_date);
  const period = await assertPeriodOpen(org_id, reverseOn);
  if ("error" in period) return { error: period.error };

  const { data: originalLines, error: e1 } = await supabase
    .from("journal_lines")
    .select("account_id, debit, credit, memo")
    .eq("journal_entry_id", id);
  if (e1) return { error: e1.message };
  if (!originalLines?.length) return { error: "Original journal has no lines" };

  const reversedLines = originalLines.map((ln) => ({
    account_id: String(ln.account_id),
    debit: Number(ln.credit ?? 0),
    credit: Number(ln.debit ?? 0),
    memo: `Reversal: ${String(ln.memo ?? "").trim()}`.trim(),
  }));
  assertBalancedLines(reversedLines.map((l) => ({ debit: l.debit, credit: l.credit })));

  const { data: reversalEntry, error: e2 } = await supabase
    .from("journal_entries")
    .insert({
      org_id,
      entry_date: reverseOn,
      description: `Reversal of ${id.slice(0, 8)}: ${String(original.description ?? "").trim()}`.trim(),
      source_type: "system",
      source_id: id,
      created_by: user.id,
      posted_by: user.id,
      reversal_of_entry_id: id,
    })
    .select("id")
    .single();
  if (e2 || !reversalEntry) return { error: e2?.message ?? "Failed to create reversal entry" };

  const { error: e3 } = await supabase.from("journal_lines").insert(
    reversedLines.map((ln) => ({
      journal_entry_id: reversalEntry.id,
      account_id: ln.account_id,
      debit: ln.debit,
      credit: ln.credit,
      memo: ln.memo,
    })),
  );
  if (e3) return { error: e3.message };

  const now = new Date().toISOString();
  const { error: e4 } = await supabase
    .from("journal_entries")
    .update({
      reversed_by_entry_id: reversalEntry.id,
      reversed_at: now,
      reversed_by: user.id,
      reversal_reason: why,
    })
    .eq("id", id)
    .eq("org_id", org_id);
  if (e4) return { error: e4.message };

  revalidatePath("/dashboard/finance/ledger");
  return { ok: true, reversalEntryId: reversalEntry.id };
}

export async function createOpeningBalanceBatch(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };
  const periodMonth = monthStart(String(formData.get("period_month") || ""));
  const fiscalYearId = String(formData.get("fiscal_year_id") || "").trim() || null;
  const note = String(formData.get("note") || "").trim() || null;
  if (!periodMonth) return { error: "Invalid period month" };

  const { data: latest } = await supabase
    .from("opening_balance_batches")
    .select("version")
    .eq("org_id", org_id)
    .eq("period_month", periodMonth)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = Number(latest?.version ?? 0) + 1;

  const { data: batch, error } = await supabase
    .from("opening_balance_batches")
    .insert({
      org_id,
      fiscal_year_id: fiscalYearId,
      period_month: periodMonth,
      version: nextVersion,
      status: "draft",
      note,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !batch) return { error: error?.message ?? "Failed to create opening balance batch" };
  revalidatePath("/dashboard/finance/ledger");
  return { ok: true, batchId: batch.id };
}

export async function addOpeningBalanceLine(formData: FormData) {
  const { supabase, user } = await orgContext();
  if (!user) return { error: "Unauthorized" };
  const batchId = String(formData.get("batch_id") || "").trim();
  const accountId = String(formData.get("account_id") || "").trim();
  const debit = Number(formData.get("debit") || 0);
  const credit = Number(formData.get("credit") || 0);
  const memo = String(formData.get("memo") || "").trim() || null;
  if (!batchId || !accountId) return { error: "Batch and account are required" };
  if (debit <= 0 && credit <= 0) return { error: "Either debit or credit must be greater than zero" };
  if (debit > 0 && credit > 0) return { error: "Use either debit or credit, not both" };

  const { error } = await supabase.from("opening_balance_lines").insert({
    batch_id: batchId,
    account_id: accountId,
    debit,
    credit,
    memo,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/ledger");
  return { ok: true };
}

export async function postOpeningBalanceBatch(batchId: string, description?: string) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };
  const id = String(batchId || "").trim();
  if (!id) return { error: "Missing opening balance batch id" };
  const { data: batch, error: bErr } = await supabase
    .from("opening_balance_batches")
    .select("id, period_month, status, note")
    .eq("id", id)
    .eq("org_id", org_id)
    .maybeSingle();
  if (bErr) return { error: bErr.message };
  if (!batch) return { error: "Batch not found" };
  if (String(batch.status) !== "draft") return { error: "Only draft batches can be posted" };

  const period = await assertPeriodOpen(org_id, String(batch.period_month));
  if ("error" in period) return { error: period.error };

  const { data: lines, error: lErr } = await supabase
    .from("opening_balance_lines")
    .select("account_id, debit, credit, memo")
    .eq("batch_id", id);
  if (lErr) return { error: lErr.message };
  if (!lines?.length) return { error: "Batch has no lines" };

  const jl = lines.map((ln) => ({
    account_id: String(ln.account_id),
    debit: Number(ln.debit ?? 0),
    credit: Number(ln.credit ?? 0),
    memo: ln.memo,
  }));
  assertBalancedLines(jl.map((x) => ({ debit: x.debit, credit: x.credit })));

  const { data: entry, error: e1 } = await supabase
    .from("journal_entries")
    .insert({
      org_id,
      entry_date: String(batch.period_month),
      description:
        String(description ?? "").trim() ||
        `Opening balances ${String(batch.period_month).slice(0, 7)}`,
      source_type: "system",
      source_id: id,
      created_by: user.id,
      posted_by: user.id,
    })
    .select("id")
    .single();
  if (e1 || !entry) return { error: e1?.message ?? "Failed to post opening balance journal" };

  const { error: e2 } = await supabase.from("journal_lines").insert(
    jl.map((x) => ({
      journal_entry_id: entry.id,
      account_id: x.account_id,
      debit: x.debit,
      credit: x.credit,
      memo: x.memo,
    })),
  );
  if (e2) return { error: e2.message };

  const { data: activePosted } = await supabase
    .from("opening_balance_batches")
    .select("id")
    .eq("org_id", org_id)
    .eq("period_month", String(batch.period_month))
    .eq("status", "posted");
  for (const row of activePosted ?? []) {
    await supabase
      .from("opening_balance_batches")
      .update({ status: "superseded", superseded_by_batch_id: id })
      .eq("id", String(row.id));
  }

  const { error: e3 } = await supabase
    .from("opening_balance_batches")
    .update({
      status: "posted",
      posted_journal_entry_id: entry.id,
      posted_by: user.id,
      posted_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (e3) return { error: e3.message };

  revalidatePath("/dashboard/finance/ledger");
  revalidatePath("/dashboard/finance/trial-balance");
  return { ok: true };
}

export async function addBankStatementLine(formData: FormData) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };
  const cashbookAccountId = String(formData.get("cashbook_account_id") || "").trim();
  const statementDate = String(formData.get("statement_date") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const direction = String(formData.get("direction") || "in").trim() as "in" | "out";
  const description = String(formData.get("description") || "").trim() || null;
  const reference = String(formData.get("reference") || "").trim() || null;
  if (!cashbookAccountId || !statementDate || amount <= 0) {
    return { error: "Cashbook, date and amount are required" };
  }
  const { error } = await supabase.from("bank_statement_lines").insert({
    org_id,
    cashbook_account_id: cashbookAccountId,
    statement_date: statementDate,
    amount,
    direction,
    description,
    reference,
    source: "manual",
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance/bank-reconciliation");
  return { ok: true };
}

export async function matchBankStatementToCashbook(
  statementLineId: string,
  cashbookTransactionId: string,
  note?: string,
) {
  const { supabase, user, org_id } = await orgContext();
  if (!user || !org_id) return { error: "Unauthorized" };
  const sid = String(statementLineId || "").trim();
  const tid = String(cashbookTransactionId || "").trim();
  if (!sid || !tid) return { error: "Statement line and cashbook transaction are required" };

  const { data: statement, error: sErr } = await supabase
    .from("bank_statement_lines")
    .select("id, amount")
    .eq("id", sid)
    .eq("org_id", org_id)
    .maybeSingle();
  if (sErr) return { error: sErr.message };
  if (!statement) return { error: "Statement line not found" };

  const { error: mErr } = await supabase.from("bank_reconciliation_matches").insert({
    org_id,
    statement_line_id: sid,
    cashbook_transaction_id: tid,
    matched_amount: Number(statement.amount ?? 0),
    note: String(note ?? "").trim() || null,
    matched_by: user.id,
  });
  if (mErr) return { error: mErr.message };

  const { error: uErr } = await supabase
    .from("bank_statement_lines")
    .update({ matched_at: new Date().toISOString(), matched_by: user.id })
    .eq("id", sid);
  if (uErr) return { error: uErr.message };

  revalidatePath("/dashboard/finance/bank-reconciliation");
  return { ok: true };
}
