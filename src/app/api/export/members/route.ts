import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { canViewJumuiyaReports } from "@/lib/auth/permissions";
import { getMyRoles } from "@/lib/auth/session";

export async function GET() {
  const roles = await getMyRoles();
  if (!canViewJumuiyaReports(roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from("members")
    .select("email, phone, status, join_date, address, notes")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Members");
  sheet.columns = [
    { header: "Email", key: "email", width: 28 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Status", key: "status", width: 12 },
    { header: "Join date", key: "join_date", width: 14 },
    { header: "Address", key: "address", width: 36 },
    { header: "Notes", key: "notes", width: 40 },
  ];
  for (const m of members ?? []) {
    sheet.addRow({
      email: m.email,
      phone: m.phone,
      status: m.status,
      join_date: m.join_date,
      address: m.address,
      notes: m.notes,
    });
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="members.xlsx"',
    },
  });
}
