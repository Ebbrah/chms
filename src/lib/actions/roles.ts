"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/roles";
import { APP_ROLES } from "@/lib/auth/roles";

export async function setUserRole(formData: FormData) {
  const supabase = await createClient();
  const userId = String(formData.get("user_id") || "");
  const role = String(formData.get("role") || "") as AppRole;
  if (!userId || !APP_ROLES.includes(role)) {
    return { error: "Invalid input" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .single();
  if (!profile?.org_id) return { error: "User profile not found" };

  const { error } = await supabase.from("user_roles").insert({
    user_id: userId,
    org_id: profile.org_id,
    role,
  });

  if (error) {
    if (error.code === "23505") return { error: "User already has this role" };
    return { error: error.message };
  }
  revalidatePath("/dashboard/settings/roles");
  return { ok: true };
}

export async function removeUserRole(userId: string, role: AppRole) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { data: me } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!me?.org_id) return { error: "No organization" };

  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", role)
    .eq("org_id", me.org_id);
  if (error) return { error: error.message };

  // Keep scoped-assignment tables in sync when a role is removed.
  if (role === "church_elder") {
    const { error: elderScopeErr } = await supabase
      .from("jumuiya_elder_assignments")
      .delete()
      .eq("org_id", me.org_id)
      .eq("user_id", userId);
    if (elderScopeErr) return { error: elderScopeErr.message };
  }

  if (role === "jumuiya_chairman") {
    const { error: chairScopeErr } = await supabase
      .from("jumuiya_chair_assignments")
      .delete()
      .eq("org_id", me.org_id)
      .eq("user_id", userId);
    if (chairScopeErr) return { error: chairScopeErr.message };

    const { error: householdChairErr } = await supabase
      .from("households")
      .update({
        chairperson_user_id: null,
        chairperson_name: null,
      })
      .eq("org_id", me.org_id)
      .eq("chairperson_user_id", userId);
    if (householdChairErr) return { error: householdChairErr.message };
  }

  if (role === "committee_head") {
    const { error: committeeScopeErr } = await supabase
      .from("committee_heads")
      .delete()
      .eq("org_id", me.org_id)
      .eq("user_id", userId);
    if (committeeScopeErr) return { error: committeeScopeErr.message };

    const { error: committeeChairErr } = await supabase
      .from("committees")
      .update({
        chairperson_user_id: null,
        chairperson_name: null,
      })
      .eq("org_id", me.org_id)
      .eq("chairperson_user_id", userId);
    if (committeeChairErr) return { error: committeeChairErr.message };
  }

  revalidatePath("/dashboard/settings/roles");
  revalidatePath("/dashboard/settings/jumuiya");
  revalidatePath("/dashboard/settings/committees");
  revalidatePath("/dashboard/page");
  return { ok: true };
}
