import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyRoles, getProfile } from "@/lib/auth/session";
import {
  canIssueTravelCertificates,
  canManageTravelCertificates,
  hasRole,
} from "@/lib/auth/permissions";
import { TravelCertificatesClient } from "./travel-certificates-client";

export const dynamic = "force-dynamic";

function computeAge(dateText: string) {
  const birthDate = new Date(dateText);
  if (Number.isNaN(birthDate.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return age >= 0 ? String(age) : "";
}

export default async function TravelCertificatesPage() {
  const supabase = await createClient();
  const profile = await getProfile();
  const roles = await getMyRoles();
  const canManage = canManageTravelCertificates(roles);
  const canIssue = canIssueTravelCertificates(roles);
  const isMember = hasRole(roles, "member");

  if (!canManage && !isMember) {
    redirect("/dashboard");
  }

  const { data: settings } = await supabase
    .from("org_certificate_settings")
    .select("*")
    .maybeSingle();

  const { data: rows } = canManage
    ? await supabase
        .from("travel_certificates")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500)
    : await supabase
        .from("travel_certificates")
        .select("*")
        .eq("member_user_id", String(profile?.id ?? ""))
        .order("created_at", { ascending: false })
        .limit(100);

  const { data: profiles } = canManage
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name")
        .limit(1000)
    : { data: [] };

  const { data: households } = await supabase.from("households").select("id, name").order("name");

  const { data: memberRow } = profile?.id
    ? await supabase
        .from("members")
        .select("offering_number, household_id, member_details")
        .eq("user_id", profile.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const memberDetails =
    memberRow?.member_details && typeof memberRow.member_details === "object"
      ? (memberRow.member_details as Record<string, unknown>)
      : {};

  const dependants: Array<{
    key: string;
    name: string;
    age: string;
    contacts: string;
    relationship: string;
  }> = [];

  const spouseName = String(memberDetails.spouse_name ?? "").trim();
  const spousePhone = String(memberDetails.spouse_phone ?? "").trim();
  if (spouseName) {
    dependants.push({
      key: `spouse:${spouseName}`,
      name: spouseName,
      age: "",
      contacts: spousePhone,
      relationship: "Spouse",
    });
  }

  const children = Array.isArray(memberDetails.children)
    ? memberDetails.children
    : [];
  for (const child of children) {
    const row = child as Record<string, unknown>;
    const childName = String(row.full_name ?? "").trim();
    if (!childName) continue;
    dependants.push({
      key: `child:${childName}`,
      name: childName,
      age: computeAge(String(row.birth_date ?? "").trim()),
      contacts: "",
      relationship: String(row.relationship ?? "Child").trim() || "Child",
    });
  }

  const { data: myIssuerAssets } =
    profile?.id && canIssue
      ? await supabase
          .from("certificate_issuer_assets")
          .select("signature_url, stamp_url")
          .eq("user_id", profile.id)
          .maybeSingle()
      : { data: null };

  return (
    <TravelCertificatesClient
      roles={roles}
      profileName={String(profile?.full_name ?? "")}
      profilePhone={String(profile?.phone ?? "")}
      settings={settings}
      certificates={rows ?? []}
      profiles={profiles ?? []}
      households={households ?? []}
      memberOfferingNumber={memberRow?.offering_number != null ? String(memberRow.offering_number).trim() : ""}
      memberHouseholdId={memberRow?.household_id != null ? String(memberRow.household_id) : ""}
      memberIsBaptized={String(memberDetails.is_baptized ?? "").trim()}
      memberIsMarried={String(memberDetails.marital_status ?? "").trim()}
      memberCommunion={String(memberDetails.takes_holy_communion ?? "").trim()}
      dependants={dependants}
      issuerAssets={myIssuerAssets}
    />
  );
}
