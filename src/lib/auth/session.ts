import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "./roles";
import { parseAppRole } from "./roles";

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getMyRoles(): Promise<AppRole[]> {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) return [];
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const roles: AppRole[] = [];
  for (const row of data ?? []) {
    const r = parseAppRole(row.role as string);
    if (r) roles.push(r);
  }
  return roles;
}

export async function getProfile() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return data;
}
