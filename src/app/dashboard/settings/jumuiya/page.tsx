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
import { JumuiyaForm } from "./jumuiya-form";

export default async function JumuiyaPage() {
  const supabase = await createClient();
  const { data: households } = await supabase
    .from("households")
    .select("id, name, chairperson_name, chairperson_user_id, created_at")
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
        .eq("role", "jumuiya_chairman");
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

  const { data: chairAssignments } = await supabase
    .from("jumuiya_chair_assignments")
    .select("household_id, user_id");
  const chairUserIdByAssignment = new Map(
    (chairAssignments ?? []).map((r) => [String(r.household_id), String(r.user_id)]),
  );

  const chairUserIdsFromHouseholds = Array.from(
    new Set((households ?? []).map((h) => String(h.chairperson_user_id ?? "")).filter(Boolean)),
  );
  const assignmentChairUserIds = Array.from(
    new Set((chairAssignments ?? []).map((r) => String(r.user_id ?? "")).filter(Boolean)),
  );
  const allChairUserIds = Array.from(new Set([...chairUserIdsFromHouseholds, ...assignmentChairUserIds]));
  const { data: chairProfilesMerged } = allChairUserIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", allChairUserIds)
    : { data: [] };
  const chairByUserId = new Map(
    (chairProfilesMerged ?? []).map((p) => [String(p.id), String(p.full_name ?? "").trim()]),
  );

  const { data: elderAssignments } = await supabase
    .from("jumuiya_elder_assignments")
    .select("household_id, user_id");
  const elderUserIdByHousehold = new Map(
    (elderAssignments ?? []).map((r) => [String(r.household_id), String(r.user_id)]),
  );
  const elderUserIds = Array.from(new Set((elderAssignments ?? []).map((r) => String(r.user_id))));
  const { data: elderProfiles } = elderUserIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", elderUserIds)
    : { data: [] };
  const elderNameByUserId = new Map(
    (elderProfiles ?? []).map((p) => [String(p.id), String(p.full_name ?? "").trim()]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Jumuiya groups</h1>
      </div>
      <JumuiyaForm chairpersonOptions={chairpersonOptions} />
      <Card>
        <CardHeader>
          <CardTitle>Jumuiya list</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Mwenyekiti wa Jumuiya</TableHead>
                <TableHead>Mzee wa kanisa</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(households ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No jumuiya found.
                  </TableCell>
                </TableRow>
              ) : (
                (households ?? []).map((h) => {
                  const elderUid = elderUserIdByHousehold.get(String(h.id));
                  const elderNm = elderUid ? elderNameByUserId.get(elderUid) : "";
                  const assignedChairUid = chairUserIdByAssignment.get(String(h.id));
                  const effectiveChairUid = assignedChairUid || String(h.chairperson_user_id ?? "");
                  const chairDisplay =
                    (effectiveChairUid && chairByUserId.get(effectiveChairUid)) ||
                    h.chairperson_name ||
                    "—";
                  return (
                    <TableRow key={h.id}>
                      <TableCell>{h.name ?? "—"}</TableCell>
                      <TableCell>{chairDisplay}</TableCell>
                      <TableCell>{elderNm || "—"}</TableCell>
                      <TableCell>
                        {h.created_at ? new Date(h.created_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="link" asChild>
                          <Link href={`/dashboard/settings/jumuiya/${h.id}`}>Edit</Link>
                        </Button>
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
