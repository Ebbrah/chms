import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/platform-guard";
import { TransferMemberForm } from "./transfer-member-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PlatformTransfersPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();

  const [{ data: parishes }, { data: transfers }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, display_name, name")
      .eq("status", "active")
      .order("display_name"),
    supabase
      .from("parish_membership_transfers")
      .select(
        `
        id,
        reason,
        created_at,
        profiles:user_id ( full_name, email ),
        from_org:from_org_id ( display_name, name ),
        to_org:to_org_id ( display_name, name )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Parish transfers</h1>
        <p className="text-sm text-muted-foreground">
          Move a member from one parish to another (pastor or member).
        </p>
      </div>

      <TransferMemberForm parishes={parishes ?? []} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent transfers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(transfers ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No transfers recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                (transfers ?? []).map((t) => {
                  const member = t.profiles as { full_name?: string; email?: string } | null;
                  const fromOrg = t.from_org as { display_name?: string; name?: string } | null;
                  const toOrg = t.to_org as { display_name?: string; name?: string } | null;
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        {member?.full_name ?? member?.email ?? "—"}
                      </TableCell>
                      <TableCell>{fromOrg?.display_name ?? fromOrg?.name ?? "—"}</TableCell>
                      <TableCell>{toOrg?.display_name ?? toOrg?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.created_at
                          ? new Date(String(t.created_at)).toLocaleDateString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
