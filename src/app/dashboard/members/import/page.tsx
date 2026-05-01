import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyRoles } from "@/lib/auth/session";
import { canFinance } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MemberSeedImportClient } from "./seed-import-client";

export default async function MemberSeedImportPage() {
  const roles = await getMyRoles();
  if (!canFinance(roles)) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Import members (Excel)</h1>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/members">Back</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload .xlsx</CardTitle>
        </CardHeader>
        <CardContent>
          <MemberSeedImportClient />
        </CardContent>
      </Card>
    </div>
  );
}

