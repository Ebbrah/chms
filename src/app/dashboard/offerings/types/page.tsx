import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyRoles } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OfferingTypesManager } from "./offering-types-manager";

export default async function OfferingTypesPage() {
  const roles = await getMyRoles();
  if (!hasRole(roles, "admin")) redirect("/dashboard/offerings");

  const supabase = await createClient();
  const { data: types } = await supabase.from("offering_types").select("id, name").order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Offering types</h1>
        </div>
        <Link
          href="/dashboard/offerings"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to offerings
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All offering types</CardTitle>
        </CardHeader>
        <CardContent>
          <OfferingTypesManager offeringTypes={types ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
