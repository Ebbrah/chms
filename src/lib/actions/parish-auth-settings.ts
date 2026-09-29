"use server";

import { revalidatePath } from "next/cache";
import { getMyOrgId, getMyRoles } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/permissions";
import type { OrgAuthMode } from "@/lib/platform/org-auth-mode";
import { createClient } from "@/lib/supabase/server";

export async function updateMyParishAuthMode(mode: OrgAuthMode) {
  const orgId = await getMyOrgId();
  const roles = await getMyRoles();
  if (!orgId || !isAdmin(roles)) {
    return { error: "Parish admin only" };
  }

  const authMode: OrgAuthMode =
    mode === "whatsapp" || mode === "both" || mode === "email" ? mode : "email";

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_org_auth_mode", {
    _org_id: orgId,
    _mode: authMode,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings/authentication");
  revalidatePath("/join");
  return { ok: true };
}
