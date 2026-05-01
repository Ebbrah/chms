"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyRoles } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/permissions";

async function getOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, orgId: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  return { supabase, orgId: profile?.org_id ?? null };
}

function normalizeKey(name: string) {
  return name.toLowerCase().trim().replaceAll(/[^a-z0-9]+/g, "_").replaceAll(/^_+|_+$/g, "");
}

function readChairpersonUserId(formData: FormData) {
  const value = String(formData.get("chairperson_user_id") || "").trim();
  return !value || value === "__none__" ? null : value;
}

async function resolveChairperson(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  chairpersonUserId: string | null,
) {
  if (!chairpersonUserId) return { chairperson_user_id: null, chairperson_name: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, org_id")
    .eq("id", chairpersonUserId)
    .maybeSingle();

  if (!profile?.id || profile.org_id !== orgId) {
    return { error: "Selected chairperson is not in your organization" };
  }

  return {
    chairperson_user_id: profile.id,
    chairperson_name: String(profile.full_name ?? "").trim() || null,
  };
}

async function ensureUserHasRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  userId: string | null,
  role: "committee_head" | "jumuiya_chairman",
) {
  if (!userId) return { ok: true } as const;
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  if (!roleRow) {
    return { error: `Selected user must first be assigned the role "${role}"` } as const;
  }
  return { ok: true } as const;
}

async function syncCommitteeHeadScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  committeeId: string,
  chairpersonUserId: string | null,
) {
  await supabase.from("committee_heads").delete().eq("org_id", orgId).eq("committee_id", committeeId);
  if (!chairpersonUserId) return;
  await supabase.from("committee_heads").insert({
    org_id: orgId,
    committee_id: committeeId,
    user_id: chairpersonUserId,
  });
}

async function syncJumuiyaChairScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  householdId: string,
  chairpersonUserId: string | null,
) {
  await supabase
    .from("jumuiya_chair_assignments")
    .delete()
    .eq("org_id", orgId)
    .eq("household_id", householdId);
  if (!chairpersonUserId) return;
  await supabase.from("jumuiya_chair_assignments").insert({
    org_id: orgId,
    household_id: householdId,
    user_id: chairpersonUserId,
  });
}

export async function createCommittee(formData: FormData) {
  const roles = await getMyRoles();
  if (!isAdmin(roles)) return { error: "Admin only" };

  const { supabase, orgId } = await getOrgId();
  if (!orgId) return { error: "Unauthorized" };

  const name = String(formData.get("name") || "").trim();
  const chairpersonUserId = readChairpersonUserId(formData);
  if (!name) return { error: "Committee name is required" };

  const key = normalizeKey(name);
  if (!key) return { error: "Committee name is invalid" };

  const chairperson = await resolveChairperson(supabase, orgId, chairpersonUserId);
  if ("error" in chairperson) return { error: chairperson.error };
  const roleCheck = await ensureUserHasRole(
    supabase,
    orgId,
    chairperson.chairperson_user_id,
    "committee_head",
  );
  if ("error" in roleCheck) return { error: roleCheck.error };

  const { data: inserted, error } = await supabase
    .from("committees")
    .insert({
    org_id: orgId,
    key,
    name,
    chairperson_name: chairperson.chairperson_name,
    chairperson_user_id: chairperson.chairperson_user_id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  if (inserted?.id) {
    await syncCommitteeHeadScope(supabase, orgId, inserted.id, chairperson.chairperson_user_id);
  }
  revalidatePath("/dashboard/settings/committees");
  revalidatePath("/dashboard/settings/roles");
  revalidatePath("/dashboard/finance/budget");
  return { ok: true };
}

export async function createJumuiya(formData: FormData) {
  const roles = await getMyRoles();
  if (!isAdmin(roles)) return { error: "Admin only" };

  const { supabase, orgId } = await getOrgId();
  if (!orgId) return { error: "Unauthorized" };

  const name = String(formData.get("name") || "").trim();
  const chairpersonUserId = readChairpersonUserId(formData);
  if (!name) return { error: "Jumuiya name is required" };

  const chairperson = await resolveChairperson(supabase, orgId, chairpersonUserId);
  if ("error" in chairperson) return { error: chairperson.error };
  const roleCheck = await ensureUserHasRole(
    supabase,
    orgId,
    chairperson.chairperson_user_id,
    "jumuiya_chairman",
  );
  if ("error" in roleCheck) return { error: roleCheck.error };

  const { data: inserted, error } = await supabase
    .from("households")
    .insert({
    org_id: orgId,
    name,
    chairperson_name: chairperson.chairperson_name,
    chairperson_user_id: chairperson.chairperson_user_id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  if (inserted?.id) {
    await syncJumuiyaChairScope(supabase, orgId, inserted.id, chairperson.chairperson_user_id);
  }
  revalidatePath("/dashboard/settings/jumuiya");
  revalidatePath("/dashboard/settings/roles");
  return { ok: true };
}

export async function updateCommittee(formData: FormData) {
  const roles = await getMyRoles();
  if (!isAdmin(roles)) return { error: "Admin only" };

  const { supabase, orgId } = await getOrgId();
  if (!orgId) return { error: "Unauthorized" };

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const chairpersonUserId = readChairpersonUserId(formData);
  if (!id || !name) return { error: "Committee id and name are required" };

  const key = normalizeKey(name);
  if (!key) return { error: "Committee name is invalid" };

  const chairperson = await resolveChairperson(supabase, orgId, chairpersonUserId);
  if ("error" in chairperson) return { error: chairperson.error };
  const roleCheck = await ensureUserHasRole(
    supabase,
    orgId,
    chairperson.chairperson_user_id,
    "committee_head",
  );
  if ("error" in roleCheck) return { error: roleCheck.error };

  const { error } = await supabase
    .from("committees")
    .update({
      name,
      key,
      chairperson_name: chairperson.chairperson_name,
      chairperson_user_id: chairperson.chairperson_user_id,
    })
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) return { error: error.message };
  await syncCommitteeHeadScope(supabase, orgId, id, chairperson.chairperson_user_id);

  revalidatePath("/dashboard/settings/committees");
  revalidatePath("/dashboard/settings/roles");
  revalidatePath("/dashboard/finance/budget");
  return { ok: true };
}

export async function updateJumuiya(formData: FormData) {
  const roles = await getMyRoles();
  if (!isAdmin(roles)) return { error: "Admin only" };

  const { supabase, orgId } = await getOrgId();
  if (!orgId) return { error: "Unauthorized" };

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const chairpersonUserId = readChairpersonUserId(formData);
  if (!id || !name) return { error: "Jumuiya id and name are required" };

  const chairperson = await resolveChairperson(supabase, orgId, chairpersonUserId);
  if ("error" in chairperson) return { error: chairperson.error };
  const roleCheck = await ensureUserHasRole(
    supabase,
    orgId,
    chairperson.chairperson_user_id,
    "jumuiya_chairman",
  );
  if ("error" in roleCheck) return { error: roleCheck.error };

  const { error } = await supabase
    .from("households")
    .update({
      name,
      chairperson_name: chairperson.chairperson_name,
      chairperson_user_id: chairperson.chairperson_user_id,
    })
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) return { error: error.message };
  await syncJumuiyaChairScope(supabase, orgId, id, chairperson.chairperson_user_id);

  revalidatePath("/dashboard/settings/jumuiya");
  revalidatePath("/dashboard/settings/roles");
  return { ok: true };
}
