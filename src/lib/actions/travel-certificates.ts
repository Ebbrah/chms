"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  canIssueTravelCertificates,
  canManageTravelCertificates,
  hasRole,
} from "@/lib/auth/permissions";
import { getMyRoles } from "@/lib/auth/session";

function revalidateTravelCertificatePaths(certificateId?: string) {
  revalidatePath("/dashboard/travel-certificates");
  if (certificateId) {
    revalidatePath(`/dashboard/travel-certificates/${certificateId}`);
  }
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function readNullable(formData: FormData, key: string) {
  const value = readText(formData, key);
  return value || null;
}

function readBool(formData: FormData, key: string) {
  return formData.get(key) === "true";
}

async function getOrgContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, orgId: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, full_name")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    user,
    orgId: String(profile?.org_id ?? ""),
    fullName: String(profile?.full_name ?? "").trim(),
  };
}

async function uploadAssetDataUrl(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string, key: string, dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return { error: "Invalid image file format" } as const;
  const contentType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  const extension = contentType.includes("png") ? "png" : "jpg";
  const path = `${orgId}/${key}-${Date.now()}.${extension}`;
  const upload = await supabase.storage
    .from("certificate-assets")
    .upload(path, bytes, { contentType, upsert: true });
  if (upload.error) return { error: upload.error.message } as const;
  const { data } = supabase.storage.from("certificate-assets").getPublicUrl(path);
  return { url: data.publicUrl } as const;
}

export async function requestTravelCertificate(formData: FormData) {
  const roles = await getMyRoles();
  if (!hasRole(roles, "member") && !canManageTravelCertificates(roles)) {
    return { error: "Unauthorized" };
  }

  const { supabase, user, orgId, fullName } = await getOrgContext();
  if (!user || !orgId) return { error: "Unauthorized" };

  const { data: settingsRow } = await supabase
    .from("org_certificate_settings")
    .select("jina_la_usharika")
    .eq("org_id", orgId)
    .maybeSingle();

  const fromSettings = String(settingsRow?.jina_la_usharika ?? "").trim();
  const fromCongregation = fromSettings || readText(formData, "from_congregation");
  const householdId = readNullable(formData, "household_id");
  const requestKind = readText(formData, "request_kind") === "dependent" ? "dependent" : "self";
  const dependentName = readNullable(formData, "dependent_name");
  const dependentAge = readNullable(formData, "dependent_age");
  const dependentContacts = readNullable(formData, "dependent_contacts");

  const { data: memberOffering } = await supabase
    .from("members")
    .select("offering_number, member_details")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const offeringSnapshot =
    String(memberOffering?.offering_number ?? "").trim() || readNullable(formData, "offering_number") || null;

  const memberDetails =
    memberOffering?.member_details && typeof memberOffering.member_details === "object"
      ? (memberOffering.member_details as Record<string, unknown>)
      : {};

  const selfBaptizedText = String(memberDetails.is_baptized ?? "").trim().toLowerCase();
  const selfMarriedText = String(memberDetails.marital_status ?? "").trim().toLowerCase();
  const selfCommunionText = String(memberDetails.takes_holy_communion ?? "").trim().toLowerCase();

  const subjectName =
    requestKind === "dependent" ? dependentName ?? "" : readText(formData, "member_name") || fullName || "Member";

  if (!subjectName) {
    return { error: "Jina la muombaji au mtegemezi linahitajika." };
  }

  const activeStatuses = ["requested", "draft"];
  const { data: existingActive } = await supabase
    .from("travel_certificates")
    .select("id, status, member_name")
    .eq("org_id", orgId)
    .eq("member_user_id", user.id)
    .eq("request_kind", requestKind)
    .eq("member_name", subjectName)
    .in("status", activeStatuses)
    .limit(1)
    .maybeSingle();

  if (existingActive?.id) {
    return {
      error: `Tayari una ombi lingine la cheti la ${subjectName} lenye hali ya "${existingActive.status}".`,
    };
  }

  const payload = {
    org_id: orgId,
    requested_by_user_id: user.id,
    member_user_id: user.id,
    member_name: subjectName,
    from_congregation: fromCongregation,
    household_id: householdId,
    address: null,
    to_congregation: readText(formData, "to_congregation"),
    is_baptized:
      formData.get("is_baptized") != null
        ? readBool(formData, "is_baptized")
        : selfBaptizedText === "ndiyo" || selfBaptizedText === "yes" || selfBaptizedText === "true",
    is_married:
      formData.get("is_married") != null
        ? readBool(formData, "is_married")
        : selfMarriedText.includes("oa") || selfMarriedText.includes("olewa"),
    takes_holy_communion:
      formData.get("takes_holy_communion") != null
        ? readBool(formData, "takes_holy_communion")
        : selfCommunionText === "ndiyo" || selfCommunionText === "yes" || selfCommunionText === "true",
    offering_number: offeringSnapshot,
    travel_purpose: readNullable(formData, "travel_purpose"),
    request_kind: requestKind,
    dependent_name: requestKind === "dependent" ? dependentName : null,
    dependent_age: requestKind === "dependent" ? dependentAge : null,
    dependent_contacts: requestKind === "dependent" ? dependentContacts : null,
    status: "requested",
  };

  if (!payload.from_congregation) {
    return {
      error:
        "Jina la Usharika limebidi liweke kwenye Mipangilio ya Cheti (au wasilisha ombi baada ya msimamizi kuhifadhi mipangilio).",
    };
  }

  if (!householdId) {
    return { error: "Chagua Jumuiya." };
  }

  if (!payload.to_congregation) {
    return { error: "Usharika unaoenda unahitajika." };
  }

  const { error } = await supabase.from("travel_certificates").insert(payload);
  if (error) return { error: error.message };

  revalidateTravelCertificatePaths();
  return { ok: true };
}

export async function upsertTravelCertificateByStaff(formData: FormData) {
  const roles = await getMyRoles();
  if (!canManageTravelCertificates(roles)) return { error: "Unauthorized" };

  const { supabase, orgId, user } = await getOrgContext();
  if (!orgId || !user) return { error: "Unauthorized" };

  const id = readText(formData, "id");
  const { data: existing } = id
    ? await supabase
        .from("travel_certificates")
        .select("*")
        .eq("id", id)
        .eq("org_id", orgId)
        .maybeSingle()
    : { data: null };
  const memberUserId = readNullable(formData, "member_user_id");
  const nextStatus = readText(formData, "status") || String(existing?.status ?? "draft");
  const householdIdStaff = formData.has("household_id")
    ? readNullable(formData, "household_id")
    : (existing?.household_id as string | null | undefined) ?? null;
  const requestKind = readText(formData, "request_kind") || String(existing?.request_kind ?? "manual");
  const payload = {
    org_id: orgId,
    member_user_id: memberUserId ?? (existing?.member_user_id as string | null | undefined) ?? null,
    requested_by_user_id:
      (existing?.requested_by_user_id as string | null | undefined) ?? memberUserId ?? user.id,
    member_name: readText(formData, "member_name") || String(existing?.member_name ?? ""),
    from_congregation:
      readText(formData, "from_congregation") || String(existing?.from_congregation ?? ""),
    household_id: householdIdStaff,
    address: formData.has("address")
      ? readNullable(formData, "address")
      : (existing?.address as string | null | undefined) ?? null,
    to_congregation:
      readText(formData, "to_congregation") || String(existing?.to_congregation ?? ""),
    is_baptized: formData.has("is_baptized")
      ? readBool(formData, "is_baptized")
      : Boolean(existing?.is_baptized),
    is_married: formData.has("is_married")
      ? readBool(formData, "is_married")
      : Boolean(existing?.is_married),
    takes_holy_communion: formData.has("takes_holy_communion")
      ? readBool(formData, "takes_holy_communion")
      : Boolean(existing?.takes_holy_communion),
    offering_number: formData.has("offering_number")
      ? readNullable(formData, "offering_number")
      : (existing?.offering_number as string | null | undefined) ?? null,
    travel_purpose: formData.has("travel_purpose")
      ? readNullable(formData, "travel_purpose")
      : (existing?.travel_purpose as string | null | undefined) ?? null,
    other_notes: formData.has("other_notes")
      ? readNullable(formData, "other_notes")
      : (existing?.other_notes as string | null | undefined) ?? null,
    dependent_name: formData.has("dependent_name")
      ? readNullable(formData, "dependent_name")
      : (existing?.dependent_name as string | null | undefined) ?? null,
    dependent_age: formData.has("dependent_age")
      ? readNullable(formData, "dependent_age")
      : (existing?.dependent_age as string | null | undefined) ?? null,
    dependent_contacts: formData.has("dependent_contacts")
      ? readNullable(formData, "dependent_contacts")
      : (existing?.dependent_contacts as string | null | undefined) ?? null,
    request_kind: requestKind,
    status: nextStatus,
    reject_reason: nextStatus === "rejected" ? readNullable(formData, "reject_reason") : null,
  };

  if (!payload.member_name || !payload.from_congregation || !payload.to_congregation) {
    return { error: "Please fill member name, from congregation and destination congregation" };
  }

  const result = id
    ? await supabase.from("travel_certificates").update(payload).eq("id", id).eq("org_id", orgId)
    : await supabase.from("travel_certificates").insert(payload);

  if (result.error) return { error: result.error.message };
  revalidateTravelCertificatePaths(id || undefined);
  return { ok: true };
}

export async function approveTravelCertificate(certificateId: string) {
  const roles = await getMyRoles();
  if (!canIssueTravelCertificates(roles)) {
    return { error: "Only pastor or evangelist can issue certificate" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_travel_certificate", {
    _certificate_id: certificateId,
  });
  if (error) return { error: error.message };
  revalidateTravelCertificatePaths(certificateId);
  return { ok: true, data };
}

export async function rejectTravelCertificate(certificateId: string, reason: string) {
  const roles = await getMyRoles();
  if (!canIssueTravelCertificates(roles)) {
    return { error: "Only pastor or evangelist can reject certificate request" };
  }

  const trimmedReason = String(reason ?? "").trim();
  if (!trimmedReason) return { error: "Reject reason is required" };

  const { supabase, orgId, user } = await getOrgContext();
  if (!orgId || !user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("travel_certificates")
    .update({
      status: "rejected",
      reject_reason: trimmedReason,
      rejected_at: new Date().toISOString(),
      rejected_by_user_id: user.id,
    })
    .eq("id", certificateId)
    .eq("org_id", orgId);

  if (error) return { error: error.message };
  revalidateTravelCertificatePaths(certificateId);
  return { ok: true };
}

export async function saveCertificateSettings(formData: FormData) {
  const roles = await getMyRoles();
  if (!canManageTravelCertificates(roles)) {
    return { error: "You do not have permission to edit certificate template settings." };
  }

  const { supabase, orgId } = await getOrgContext();
  if (!orgId) return { error: "Unauthorized" };

  const nextNumberRaw = Number(readText(formData, "next_certificate_number"));
  const nextCertificateNumber = Number.isFinite(nextNumberRaw) && nextNumberRaw > 0 ? nextNumberRaw : 1;
  const payload: Record<string, unknown> = {
    org_id: orgId,
    church_name: readText(formData, "church_name") || "Kanisa la Kiinjili la Kilutheri Tanzania",
    diocese_name: readText(formData, "diocese_name") || "Dayosisi ya Dodoma",
    postal_box: readText(formData, "postal_box") || "P.O.Box 1682 - Dodoma",
    next_certificate_number: nextCertificateNumber,
    jina_la_usharika: readText(formData, "jina_la_usharika"),
  };

  const logoDataUrl = readText(formData, "logo_data_url");
  if (logoDataUrl) {
    const uploaded = await uploadAssetDataUrl(supabase, orgId, "logo", logoDataUrl);
    if ("error" in uploaded) return uploaded;
    payload.logo_url = uploaded.url;
  }

  const signatureDataUrl = readText(formData, "pastor_signature_data_url");
  if (signatureDataUrl) {
    const uploaded = await uploadAssetDataUrl(supabase, orgId, "pastor-signature", signatureDataUrl);
    if ("error" in uploaded) return uploaded;
    payload.pastor_signature_url = uploaded.url;
  }

  const stampDataUrl = readText(formData, "pastor_stamp_data_url");
  if (stampDataUrl) {
    const uploaded = await uploadAssetDataUrl(supabase, orgId, "pastor-stamp", stampDataUrl);
    if ("error" in uploaded) return uploaded;
    payload.pastor_stamp_url = uploaded.url;
  }

  const { error } = await supabase
    .from("org_certificate_settings")
    .upsert(payload, { onConflict: "org_id" });
  if (error) return { error: error.message };

  revalidateTravelCertificatePaths();
  return { ok: true };
}

export async function saveMyIssuerAssets(formData: FormData) {
  const roles = await getMyRoles();
  if (!canIssueTravelCertificates(roles)) {
    return { error: "Only pastor or evangelist can save issuer signature and stamp." };
  }

  const { supabase, orgId, user } = await getOrgContext();
  if (!orgId || !user) return { error: "Unauthorized" };

  const payload: Record<string, unknown> = {
    org_id: orgId,
    user_id: user.id,
  };

  const signatureDataUrl = readText(formData, "signature_data_url");
  if (signatureDataUrl) {
    const uploaded = await uploadAssetDataUrl(supabase, orgId, `issuer-signature-${user.id}`, signatureDataUrl);
    if ("error" in uploaded) return uploaded;
    payload.signature_url = uploaded.url;
  }

  const stampDataUrl = readText(formData, "stamp_data_url");
  if (stampDataUrl) {
    const uploaded = await uploadAssetDataUrl(supabase, orgId, `issuer-stamp-${user.id}`, stampDataUrl);
    if ("error" in uploaded) return uploaded;
    payload.stamp_url = uploaded.url;
  }

  const { error } = await supabase
    .from("certificate_issuer_assets")
    .upsert(payload, { onConflict: "org_id,user_id" });
  if (error) return { error: error.message };

  revalidateTravelCertificatePaths();
  return { ok: true };
}
