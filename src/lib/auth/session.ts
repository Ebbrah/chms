import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "./roles";
import { parseAppRole } from "./roles";

function isMissingSchemaError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const msg = String(error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "42703" ||
    msg.includes("does not exist") ||
    msg.includes("could not find")
  );
}

/** Dedupe auth/profile reads within a single RSC request. */
export const getSessionUser = cache(async () => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
});

/** Mirrors SQL `current_org_id()` — context org only for platform admin / operators. */
export const getMyOrgId = cache(async (): Promise<string | null> => {
  try {
    const supabase = await createClient();
    const user = await getSessionUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("org_id, context_org_id")
      .eq("id", user.id)
      .maybeSingle();

    if (error && isMissingSchemaError(error)) {
      const { data: fallback } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .maybeSingle();
      return fallback?.org_id ?? null;
    }

    if (!data) return null;

    const contextOrgId = data.context_org_id ?? null;
    if (contextOrgId) {
      const [admin, operatorOrgIds] = await Promise.all([
        isPlatformAdmin(),
        getPlatformParishOperatorOrgIds(),
      ]);
      if (admin || operatorOrgIds.includes(contextOrgId)) {
        return contextOrgId;
      }
    }

    return data.org_id ?? null;
  } catch {
    return null;
  }
});

function parseRoles(rows: { role: string }[] | null | undefined): AppRole[] {
  const roles: AppRole[] = [];
  for (const row of rows ?? []) {
    const r = parseAppRole(row.role as string);
    if (r) roles.push(r);
  }
  return roles;
}

export const getMyRoles = cache(async (): Promise<AppRole[]> => {
  try {
    const supabase = await createClient();
    const user = await getSessionUser();
    if (!user) return [];

    const orgId = await getMyOrgId();

    if (orgId) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("org_id", orgId);
      const scoped = parseRoles(data);
      if (scoped.length > 0) return scoped;
    }

    // Pre-MT / schema-lag safety: keep Ebenezer nav working if org-scoped read is empty.
    const { data: fallback } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    return parseRoles(fallback);
  } catch {
    return [];
  }
});

/** True when the signed-in user is in platform_admins (MT-1+). */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  try {
    const supabase = await createClient();
    const user = await getSessionUser();
    if (!user) return false;
    const { data, error } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error && isMissingSchemaError(error)) return false;
    return Boolean(data?.user_id);
  } catch {
    return false;
  }
});

/** Platform team members assigned to operate specific parishes. */
export const getPlatformParishOperatorOrgIds = cache(async (): Promise<string[]> => {
  try {
    const supabase = await createClient();
    const user = await getSessionUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from("platform_parish_operators")
      .select("org_id")
      .eq("user_id", user.id);
    if (error && isMissingSchemaError(error)) return [];
    return (data ?? []).map((row) => row.org_id as string);
  } catch {
    return [];
  }
});

export const getProfile = cache(async () => {
  try {
    const supabase = await createClient();
    const user = await getSessionUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, org_id, full_name, email, phone, context_org_id, avatar_url, sms_opt_in")
      .eq("id", user.id)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
});
