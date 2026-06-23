import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getMyOrgId } from "@/lib/auth/session";

export type ParishBranding = {
  displayName: string;
  logoUrl: string | null;
  slug: string | null;
};

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const msg = String(error.message ?? "").toLowerCase();
  return (
    error.code === "42703" ||
    msg.includes("column") ||
    msg.includes("does not exist")
  );
}

/** Load display name and logo for the user's effective parish. */
export const getCurrentParishBranding = cache(async (): Promise<ParishBranding | null> => {
  try {
    const supabase = await createClient();
    const orgId = await getMyOrgId();
    if (!orgId) return null;

    const { data: org, error } = await supabase
      .from("organizations")
      .select("display_name, name, logo_url, slug")
      .eq("id", orgId)
      .maybeSingle();

    if (!error && org) {
      return {
        displayName: String(org.display_name ?? org.name ?? "Ebenezer"),
        logoUrl: org.logo_url ?? null,
        slug: org.slug ?? null,
      };
    }

    // MT-1 columns may not exist yet — use legacy name column only.
    if (isMissingColumnError(error)) {
      const { data: basic } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .maybeSingle();
      if (!basic) return null;
      return {
        displayName: String(basic.name ?? "Ebenezer"),
        logoUrl: null,
        slug: null,
      };
    }

    return null;
  } catch {
    return null;
  }
});
