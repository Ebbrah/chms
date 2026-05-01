import { NextResponse } from "next/server";
import React from "react";
import { Document, Page, StyleSheet, Text, pdf } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { canViewJumuiyaReports } from "@/lib/auth/permissions";
import { getMyRoles } from "@/lib/auth/session";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10 },
  title: { fontSize: 16, marginBottom: 12 },
  row: { marginBottom: 4 },
});

export async function GET() {
  const roles = await getMyRoles();
  if (!canViewJumuiyaReports(roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from("members")
    .select("email, phone, status")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Member directory</Text>
        {(members ?? []).map((m, i) => (
          <Text key={i} style={styles.row}>
            {m.email ?? "—"} · {m.phone ?? "—"} · {m.status}
          </Text>
        ))}
      </Page>
    </Document>
  );

  const raw: unknown = await pdf(doc).toBuffer();
  let arrayBuffer: ArrayBuffer;
  if (raw instanceof ReadableStream) {
    arrayBuffer = await new Response(raw).arrayBuffer();
  } else if (raw instanceof Uint8Array) {
    const u8 = raw;
    arrayBuffer = u8.buffer.slice(
      u8.byteOffset,
      u8.byteOffset + u8.byteLength,
    ) as ArrayBuffer;
  } else if (raw instanceof ArrayBuffer) {
    arrayBuffer = raw;
  } else {
    throw new Error("Unexpected PDF buffer type");
  }

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="members.pdf"',
    },
  });
}
