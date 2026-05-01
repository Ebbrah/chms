export function assertBalancedLines(
  lines: { debit: number; credit: number }[],
) {
  const debit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const credit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  if (Math.abs(debit - credit) > 0.005) {
    throw new Error(
      `Journal must balance: debits ${debit.toFixed(2)} vs credits ${credit.toFixed(2)}`,
    );
  }
}
