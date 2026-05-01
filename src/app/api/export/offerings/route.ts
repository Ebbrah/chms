import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { canFinance } from "@/lib/auth/permissions";
import { getMyRoles } from "@/lib/auth/session";

export async function GET() {
  const roles = await getMyRoles();
  const ok =
    canFinance(roles) || roles.includes("pastor");
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("offerings")
    .select(
      "amount, currency, received_at, payment_method, reference, member_id, offering_types(name)",
    )
    .order("received_at", { ascending: false })
    .limit(5000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Offerings");
  sheet.columns = [
    { header: "Received", key: "received_at", width: 22 },
    { header: "Type", key: "type", width: 20 },
    { header: "Amount", key: "amount", width: 12 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Member ID", key: "member_id", width: 36 },
    { header: "Method", key: "payment_method", width: 14 },
    { header: "Reference", key: "reference", width: 20 },
  ];
  for (const o of rows ?? []) {
    const ot = o.offering_types as { name?: string } | null;
    sheet.addRow({
      received_at: o.received_at,
      type: ot?.name,
      amount: o.amount,
      currency: o.currency,
      member_id: o.member_id,
      payment_method: o.payment_method,
      reference: o.reference,
    });
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="offerings.xlsx"',
    },
  });
}
