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
  revalidatePath("/dashboard/settings/roles");
  return { ok: true };
}
