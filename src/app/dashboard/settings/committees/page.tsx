import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CommitteeForm } from "./committee-form";

export default async function CommitteesPage() {
  const supabase = await createClient();
  const { data: committees } = await supabase
    .from("committees")
    .select("id, key, name, chairperson_name, chairperson_user_id, created_at")
    .order("name");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let chairpersonOptions: Array<{ id: string; full_name: string | null }> = [];

  if (user?.id) {
    const { data: me } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();
    const orgId = String(me?.org_id ?? "").trim();
    if (orgId) {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("role", "committee_head");
      const userIds = Array.from(
        new Set((roleRows ?? []).map((r) => String(r.user_id ?? "")).filter(Boolean)),
      );
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds)
          .order("full_name", { ascending: true });
        chairpersonOptions = (profiles ?? []) as Array<{ id: string; full_name: string | null }>;
      }
    }
  }

  const chairByUserId = new Map(chairpersonOptions.map((p) => [p.id, String(p.full_name ?? "").trim()]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Committees</h1>
      </div>
      <CommitteeForm chairpersonOptions={chairpersonOptions} />
      <Card>
        <CardHeader>
          <CardTitle>Committee list</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
              <TableHead>Mwenyekiti wa Kamati</TableHead>
                <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(committees ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No committees found.
                  </TableCell>
                </TableRow>
              ) : (
                (committees ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.key}</TableCell>
                  <TableCell>
                    {chairByUserId.get(String(c.chairperson_user_id ?? "")) || c.chairperson_name || "—"}
                  </TableCell>
                    <TableCell>
                      {c.created_at ? new Date(c.created_at).toLocaleString() : "—"}
                    </TableCell>
                  <TableCell className="text-right">
                    <Button variant="link" asChild>
                      <Link href={`/dashboard/settings/committees/${c.id}`}>Edit</Link>
                    </Button>
                  </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
