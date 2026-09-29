import { redirect } from "next/navigation";
import { getMyOrgId, getMyRoles } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ParishAuthModeForm } from "@/components/settings/parish-auth-mode-form";
import { updateMyParishAuthMode } from "@/lib/actions/parish-auth-settings";

export default async function ParishAuthenticationSettingsPage() {
  const orgId = await getMyOrgId();
  const roles = await getMyRoles();
  if (!orgId || !isAdmin(roles)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("settings, slug, display_name")
    .eq("id", orgId)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Authentication</h1>
        <p className="text-sm text-muted-foreground">
          {org?.display_name ?? "Parish"} · join link{" "}
          <code className="rounded bg-muted px-1">/join/{org?.slug ?? "…"}</code>
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Member sign-in method</CardTitle>
        </CardHeader>
        <CardContent>
          <ParishAuthModeForm settings={org?.settings} onSave={updateMyParishAuthMode} />
        </CardContent>
      </Card>
    </div>
  );
}
