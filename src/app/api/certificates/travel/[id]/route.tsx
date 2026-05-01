import React from "react";
import { NextResponse } from "next/server";
import { Document, Image as PdfImage, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { getMyRoles } from "@/lib/auth/session";
import { canManageTravelCertificates } from "@/lib/auth/permissions";

const styles = StyleSheet.create({
  page: { padding: 22, fontSize: 11, lineHeight: 1.38 },
  frame: { borderWidth: 1, borderColor: "#111", padding: 18, minHeight: "100%" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logoCell: { width: 80, alignItems: "flex-start" },
  logo: { width: 64, height: 64, objectFit: "contain" },
  headingWrap: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  metaCell: { width: 150, alignItems: "flex-end", gap: 2 },
  heading1: { fontSize: 16, fontWeight: "bold" },
  heading2: { fontSize: 14, marginTop: 2 },
  heading3: { fontSize: 14, marginTop: 1 },
  titleRow: { marginTop: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  title: { fontSize: 12, textDecoration: "underline" },
  body: { marginTop: 14, gap: 7 },
  field: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  label: { width: 182 },
  lineValue: { flex: 1, borderBottomWidth: 1, borderBottomColor: "#111", paddingBottom: 2, minHeight: 18 },
  multiValue: { flex: 1, borderBottomWidth: 1, borderBottomColor: "#111", minHeight: 28, paddingBottom: 2 },
  signSection: { marginTop: 24, borderTopWidth: 1, borderTopColor: "#111", paddingTop: 10 },
  signRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  signWrap: { width: "60%" },
  signLabel: { marginTop: 4 },
  signImage: { width: 190, height: 58, objectFit: "contain" },
  stampWrap: { width: "35%", alignItems: "center", justifyContent: "flex-end" },
  stampImage: { width: 120, height: 120, objectFit: "contain" },
  footerNote: { marginTop: 12, fontSize: 9, color: "#444" },
});

function boolLabel(v: unknown) {
  return v ? "Ndiyo" : "Hapana";
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const roles = await getMyRoles();
  const canManage = canManageTravelCertificates(roles);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: cert, error } = await supabase
    .from("travel_certificates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !cert) return NextResponse.json({ error: "Certificate not found" }, { status: 404 });

  const isOwner = String(cert.member_user_id ?? "") === user.id;
  if (!canManage && !isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (String(cert.status ?? "") !== "issued") {
    return NextResponse.json({ error: "Certificate not issued yet" }, { status: 400 });
  }

  const { data: settings } = await supabase
    .from("org_certificate_settings")
    .select("*")
    .eq("org_id", String(cert.org_id))
    .maybeSingle();

  let jumuiyaDisplay = String(cert.address ?? "").trim();
  if (cert.household_id) {
    const { data: hh } = await supabase
      .from("households")
      .select("name")
      .eq("id", String(cert.household_id))
      .maybeSingle();
    jumuiyaDisplay = String(hh?.name ?? "").trim() || jumuiyaDisplay || "—";
  } else if (!jumuiyaDisplay) {
    jumuiyaDisplay = "—";
  }

  const offeringNumberDisplay = String(cert.offering_number ?? "").trim() || "—";

  const issueDate = cert.issued_date ?? cert.issued_at ?? cert.created_at;
  const dateStr = issueDate ? new Date(String(issueDate)).toISOString().slice(0, 10) : "";
  const certNumber = String(cert.certificate_number ?? "");

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.headerRow}>
            <View style={styles.logoCell}>
              {settings?.logo_url ? <PdfImage style={styles.logo} src={String(settings.logo_url)} /> : <View />}
            </View>
            <View style={styles.headingWrap}>
              <Text style={styles.heading1}>
                {String(settings?.church_name ?? "Kanisa la Kiinjili la Kilutheri Tanzania")}
              </Text>
              <Text style={styles.heading2}>{String(settings?.diocese_name ?? "Dayosisi ya Dodoma")}</Text>
              <Text style={styles.heading3}>{String(settings?.postal_box ?? "P.O.Box 1682 - Dodoma")}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text>Certificate No: {certNumber || "Pending"}</Text>
              <Text>Date: {dateStr}</Text>
            </View>
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.title}>CHETI CHA SAFARI</Text>
          </View>

          <View style={styles.body}>
            <View style={styles.field}>
              <Text style={styles.label}>Jina:</Text>
              <Text style={styles.lineValue}>{String(cert.member_name ?? "")}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Usharika anaotoka:</Text>
              <Text style={styles.lineValue}>{String(cert.from_congregation ?? "")}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Jumuiya:</Text>
              <Text style={styles.lineValue}>{jumuiyaDisplay}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Usharika anaoenda:</Text>
              <Text style={styles.lineValue}>{String(cert.to_congregation ?? "")}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Amebatizwa:</Text>
              <Text style={styles.lineValue}>{boolLabel(cert.is_baptized)}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Ameoa/Ameolewa:</Text>
              <Text style={styles.lineValue}>{boolLabel(cert.is_married)}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Namba ya Bahasha:</Text>
              <Text style={styles.lineValue}>{offeringNumberDisplay}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Kusudi la Safari:</Text>
              <Text style={styles.multiValue}>{String(cert.travel_purpose ?? "—")}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Mengineyo:</Text>
              <Text style={styles.multiValue}>{String(cert.other_notes ?? "—")}</Text>
            </View>
          </View>

          <View style={styles.signSection}>
            <View style={styles.signRow}>
              <View style={styles.signWrap}>
                {cert.pastor_signature_url ? (
                  <PdfImage style={styles.signImage} src={String(cert.pastor_signature_url)} />
                ) : null}
                <Text style={styles.signLabel}>
                  Sahihi ya Mchungaji/Mwinjilisti: {String(cert.signer_name ?? "—")}
                </Text>
              </View>
              <View style={styles.stampWrap}>
                {cert.pastor_stamp_url ? (
                  <PdfImage style={styles.stampImage} src={String(cert.pastor_stamp_url)} />
                ) : null}
              </View>
            </View>
            <Text style={styles.footerNote}>
              Cheti hiki kimetolewa rasmi na kanisa la kutuma kwa ajili ya utambulisho wa msharika anaposafiri.
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );

  const raw: unknown = await pdf(doc).toBuffer();
  let arrayBuffer: ArrayBuffer;
  if (raw instanceof ReadableStream) {
    arrayBuffer = await new Response(raw).arrayBuffer();
  } else if (raw instanceof Uint8Array) {
    arrayBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
  } else if (raw instanceof ArrayBuffer) {
    arrayBuffer = raw;
  } else {
    throw new Error("Unexpected PDF buffer type");
  }

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="travel-certificate-${certNumber || id}.pdf"`,
    },
  });
}
