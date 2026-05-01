"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canFinance, isAdmin } from "@/lib/auth/permissions";
import { getMyRoles } from "@/lib/auth/session";

function readText(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function readNullable(formData: FormData, key: string) {
  const v = readText(formData, key);
  return v || null;
}

function buildMemberDetails(formData: FormData) {
  const children: Array<{ full_name: string; birth_date: string; relationship: string }> = [];
  for (let i = 0; i < 7; i += 1) {
    const fullName = readText(formData, `child_full_name_${i}`);
    const birthDate = readText(formData, `child_birth_date_${i}`);
    const relationship = readText(formData, `child_relationship_${i}`);
    if (fullName || birthDate || relationship) {
      children.push({
        full_name: fullName,
        birth_date: birthDate,
        relationship,
      });
    }
  }

  const ministries = formData
    .getAll("ministries")
    .map((v) => String(v).trim())
    .filter(Boolean);

  return {
    passport_photo_data_url: readText(formData, "passport_photo_data_url"),
    birth_place: readText(formData, "birth_place"),
    marital_status: readText(formData, "marital_status"),
    spouse_name: readText(formData, "spouse_name"),
    spouse_phone: readText(formData, "spouse_phone"),
    postal_address: readText(formData, "postal_address"),
    occupation: readText(formData, "occupation"),
    education_level: readText(formData, "education_level"),
    profession: readText(formData, "profession"),
    work_place: readText(formData, "work_place"),
    is_baptized: readText(formData, "is_baptized"),
    has_confirmation: readText(formData, "has_confirmation"),
    takes_holy_communion: readText(formData, "takes_holy_communion"),
    participates_in_jumuiya: readText(formData, "participates_in_jumuiya"),
    marriage_type: readText(formData, "marriage_type"),
    marriage_date: readText(formData, "marriage_date"),
    pledge_1: readText(formData, "pledge_1"),
    pledge_2: readText(formData, "pledge_2"),
    pledge_3: readText(formData, "pledge_3"),
    ministries,
    children,
  };
}

function parseDataUrlImage(
  dataUrl: string,
): { contentType: string; bytes: Uint8Array; extension: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const contentType = match[1];
  const base64 = match[2];
  const bytes = Buffer.from(base64, "base64");

  let extension = "jpg";
  if (contentType.includes("png")) extension = "png";
  else if (contentType.includes("webp")) extension = "webp";
  else if (contentType.includes("gif")) extension = "gif";
  else if (contentType.includes("jpeg") || contentType.includes("jpg")) extension = "jpg";

  return { contentType, bytes, extension };
}

async function orgContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, orgId: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  return { supabase, user, orgId: profile?.org_id ?? null };
}

async function linkUnassignedOfferingsByNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  memberId: string,
  offeringNumber: string | null,
) {
  const normalizedOfferingNumber = String(offeringNumber ?? "").trim();
  if (!normalizedOfferingNumber) return;

  const { error } = await supabase
    .from("offerings")
    .update({ member_id: memberId })
    .eq("org_id", orgId)
    .is("member_id", null)
    .ilike("offering_number_snapshot", normalizedOfferingNumber);

  if (error) {
    throw new Error(`Could not auto-link prior offerings: ${error.message}`);
  }
}

export async function createMember(formData: FormData) {
  const roles = await getMyRoles();
  if (!canFinance(roles)) return { error: "Unauthorized" };

  const { supabase, orgId } = await orgContext();
  if (!orgId) return { error: "Unauthorized" };

  const email = readNullable(formData, "email");
  const phone = readNullable(formData, "phone");
  const address = readNullable(formData, "address");
  const notes = readNullable(formData, "notes");
  const pastoral_notes = readNullable(formData, "pastoral_notes");
  const status = readText(formData, "status") || "active";

  const { error } = await supabase.from("members").insert({
    org_id: orgId,
    email,
    phone,
    address,
    notes,
    pastoral_notes,
    status,
    member_details: {},
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/members");
  return { ok: true };
}

/** When user picks a jumuiya on the member form, fill chair + assigned mzee from DB. */
export async function getHouseholdLeaderIdsForForm(householdId: string) {
  const roles = await getMyRoles();
  if (!canFinance(roles)) return { error: "Unauthorized" } as const;
  const hid = String(householdId ?? "").trim();
  if (!hid || hid === "__none__") {
    return { chairUserId: "", elderUserId: "" } as const;
  }

  const { supabase, orgId } = await orgContext();
  if (!orgId) return { error: "Unauthorized" } as const;

  const { data: h } = await supabase
    .from("households")
    .select("chairperson_user_id, org_id")
    .eq("id", hid)
    .maybeSingle();
  if (!h || String(h.org_id) !== orgId) return { error: "Jumuiya not found" } as const;

  const { data: e } = await supabase
    .from("jumuiya_elder_assignments")
    .select("user_id")
    .eq("household_id", hid)
    .eq("org_id", orgId)
    .limit(1)
    .maybeSingle();

  let chairUserId = String(h.chairperson_user_id ?? "").trim();
  if (!chairUserId) {
    const { data: ca } = await supabase
      .from("jumuiya_chair_assignments")
      .select("user_id")
      .eq("household_id", hid)
      .eq("org_id", orgId)
      .limit(1)
      .maybeSingle();
    chairUserId = String(ca?.user_id ?? "").trim();
  }

  return {
    chairUserId,
    elderUserId: String(e?.user_id ?? ""),
  } as const;
}

export async function upsertMemberForUser(userId: string, formData: FormData) {
  try {
    return await upsertMemberForUserInner(userId, formData);
  } catch (e) {
    console.error("upsertMemberForUser", e);
    return { error: e instanceof Error ? e.message : "Unexpected server error" };
  }
}

async function upsertMemberForUserInner(userId: string, formData: FormData) {
  const roles = await getMyRoles();
  if (!canFinance(roles)) return { error: "Unauthorized" };
  if (!userId) return { error: "Missing user id" };

  const { supabase, orgId } = await orgContext();
  if (!orgId) return { error: "Unauthorized" };

  const { data: profileUser } = await supabase
    .from("profiles")
    .select("id, org_id, full_name, email")
    .eq("id", userId)
    .single();

  if (!profileUser?.org_id || profileUser.org_id !== orgId) {
    return { error: "User profile not found in your organization" };
  }

  const submittedDisplayName = readText(formData, "full_name");
  const resolvedDisplayName =
    submittedDisplayName.trim() ||
    String(profileUser.full_name ?? "").trim() ||
    String(profileUser.email ?? "").split("@")[0] ||
    "Member";

  const household_id = readNullable(formData, "household_id");
  const join_date = readNullable(formData, "join_date");
  const email = readNullable(formData, "email") ?? profileUser.email ?? null;
  const phone = readNullable(formData, "phone");
  const address = readNullable(formData, "address");
  const notes = readNullable(formData, "notes");
  const pastoral_notes = readNullable(formData, "pastoral_notes");
  const status = readText(formData, "status") || "active";
  const gender = readText(formData, "gender");
  const birthDate = readText(formData, "birth_date");

  const details = buildMemberDetails(formData);
  const detailsWithoutPhotoData = { ...details };
  delete (detailsWithoutPhotoData as Record<string, unknown>).passport_photo_data_url;

  const churchElderUserId = readNullable(formData, "church_elder_user_id");
  const jumuiyaChairUserId = readNullable(formData, "jumuiya_chairperson_user_id");
  let church_elder_name = "";
  let jumuiya_chairperson = "";
  if (churchElderUserId) {
    const { data: ep } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", churchElderUserId)
      .maybeSingle();
    church_elder_name = String(ep?.full_name ?? "").trim();
  }
  if (jumuiyaChairUserId) {
    const { data: cp } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", jumuiyaChairUserId)
      .maybeSingle();
    jumuiya_chairperson = String(cp?.full_name ?? "").trim();
  }

  const { data: existing } = await supabase
    .from("members")
    .select(
      "id, member_details, offering_number, household_id, join_date, email, phone, address, notes, pastoral_notes, status",
    )
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Offering number is managed by seed loading / controlled flows, not freeform profile edits.
  const offering_number =
    existing?.offering_number != null ? String(existing.offering_number).trim() || null : null;

  let passportPhotoPath: string | undefined;
  let passportPhotoUrl: string | undefined;

  const oldDetails = (existing?.member_details ?? {}) as Record<string, unknown>;
  const oldPhotoPath =
    typeof oldDetails.passport_photo_path === "string" ? oldDetails.passport_photo_path : "";

  const photoDataUrl = details.passport_photo_data_url;
  if (photoDataUrl && photoDataUrl.startsWith("data:image/")) {
    const parsed = parseDataUrlImage(photoDataUrl);
    if (!parsed) return { error: "Invalid passport photo format" };

    const path = `${orgId}/${userId}/passport-${Date.now()}.${parsed.extension}`;
    const upload = await supabase.storage
      .from("member-passports")
      .upload(path, parsed.bytes, { contentType: parsed.contentType, upsert: true });

    if (upload.error) return { error: upload.error.message };

    const { data: publicData } = supabase.storage.from("member-passports").getPublicUrl(path);

    passportPhotoPath = path;
    passportPhotoUrl = publicData.publicUrl;

    if (oldPhotoPath && oldPhotoPath !== path) {
      await supabase.storage.from("member-passports").remove([oldPhotoPath]);
    }
  } else if (oldPhotoPath) {
    passportPhotoPath = oldPhotoPath;
    const { data: publicData } = supabase.storage
      .from("member-passports")
      .getPublicUrl(oldPhotoPath);
    passportPhotoUrl = publicData.publicUrl;
  }

  const nextMemberDetails = {
    ...oldDetails,
    ...detailsWithoutPhotoData,
    passport_photo_path: passportPhotoPath,
    passport_photo_url: passportPhotoUrl,
    full_name: resolvedDisplayName,
    gender,
    birth_date: birthDate,
    church_elder_name,
    church_elder_user_id: churchElderUserId ?? "",
    jumuiya_chairperson,
    jumuiya_chairperson_user_id: jumuiyaChairUserId ?? "",
    // Pledge values are controlled by seed load and should not change from member edit page.
    pledge_1: String(oldDetails.pledge_1 ?? detailsWithoutPhotoData.pledge_1 ?? "").trim(),
    pledge_2: String(oldDetails.pledge_2 ?? detailsWithoutPhotoData.pledge_2 ?? "").trim(),
    pledge_3: String(oldDetails.pledge_3 ?? detailsWithoutPhotoData.pledge_3 ?? "").trim(),
  };

  const memberDetailsJson = JSON.parse(JSON.stringify(nextMemberDetails)) as Record<string, unknown>;

  const payload = {
    org_id: orgId,
    user_id: userId,
    household_id,
    offering_number,
    join_date,
    email,
    phone,
    address,
    notes,
    pastoral_notes,
    status,
    member_details: memberDetailsJson,
  };

  if (offering_number) {
    const { data: numberOwner } = await supabase
      .from("members")
      .select("id, user_id")
      .eq("org_id", orgId)
      .eq("offering_number", offering_number)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (numberOwner?.id && numberOwner.id !== existing?.id) {
      return { error: `Offering number "${offering_number}" is already assigned to another member.` };
    }
  }

  const writeResult = existing?.id
    ? await supabase.from("members").update(payload).eq("id", existing.id).select("id").single()
    : await supabase.from("members").insert(payload).select("id").single();
  const { data: savedMember, error } = writeResult;

  if (error) {
    if (error.code === "23505" && error.message.includes("idx_members_org_offering_number_uniq")) {
      return {
        error: `Offering number "${offering_number ?? ""}" is already assigned to another member.`,
      };
    }
    return { error: error.message };
  }

  const { error: profileNameErr } = await supabase
    .from("profiles")
    .update({ full_name: resolvedDisplayName })
    .eq("id", userId)
    .eq("org_id", orgId);
  if (profileNameErr) return { error: profileNameErr.message };

  try {
    await linkUnassignedOfferingsByNumber(
      supabase,
      orgId,
      String(savedMember?.id ?? existing?.id ?? ""),
      offering_number,
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not auto-link prior offerings" };
  }

  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/members/cards");
  revalidatePath(`/dashboard/members/${userId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function revokeUserIfNoOfferingNumber(userId: string) {
  const roles = await getMyRoles();
  if (!canFinance(roles)) return { error: "Unauthorized" };
  const isAdminUser = isAdmin(roles);
  if (!userId) return { error: "Missing user id" };

  const { supabase, orgId } = await orgContext();
  if (!orgId) return { error: "Unauthorized" };

  const { data: member } = await supabase
    .from("members")
    .select("id, offering_number")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (member?.offering_number && String(member.offering_number).trim() && !isAdminUser) {
    return { error: "Only admins can revoke users with an assigned offering number" };
  }

  if (member?.id) {
    const { error: memberDeleteError } = await supabase.from("members").delete().eq("id", member.id);

    if (memberDeleteError) return { error: memberDeleteError.message };
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return { error: deleteError.message };

  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/settings/roles");
  return { ok: true };
}
