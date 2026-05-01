import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyRoles, getProfile } from "@/lib/auth/session";
import {
  canIssueTravelCertificates,
  canManageTravelCertificates,
  hasRole,
} from "@/lib/auth/permissions";
import { TravelCertificateDetailClient } from "./travel-certificate-detail-client";

export const dynamic = "force-dynamic";

export default async function TravelCertificateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const roles = await getMyRoles();
  const profile = await getProfile();
  const canManage = canManageTravelCertificates(roles);
  const canIssue = canIssueTravelCertificates(roles);

  const { data: cert } = await supabase
    .from("travel_certificates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!cert) notFound();

  const isOwner = String(cert.member_user_id ?? "") === String(profile?.id ?? "");
  if (!canManage && !isOwner && !hasRole(roles, "member")) notFound();

  const { data: households } = await supabase.from("households").select("id, name").order("name");
  const { data: settings } = await supabase
    .from("org_certificate_settings")
    .select("*")
    .maybeSingle();

  const householdName =
    (households ?? []).find((row) => String(row.id) === String(cert.household_id ?? ""))?.name ?? null;

  return (
    <TravelCertificateDetailClient
      certificate={cert as Record<string, unknown>}
      households={households ?? []}
      settings={(settings ?? null) as Record<string, unknown> | null}
      householdName={String(householdName ?? "")}
      canManage={canManage}
      canIssue={canIssue}
      isOwner={isOwner}
    />
  );
}
