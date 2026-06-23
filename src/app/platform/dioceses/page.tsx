import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/platform-guard";
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

export default async function DiocesesListPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();

  const { data: dioceses } = await supabase
    .from("dioceses")
    .select("id, name, code, created_at")
    .order("name");

  const { data: districtCounts } = await supabase.from("districts").select("diocese_id");
  const { data: orgRows } = await supabase
    .from("organizations")
    .select("district_id, districts ( diocese_id )");

  const districtsByDiocese = new Map<string, number>();
  for (const row of districtCounts ?? []) {
    const id = String(row.diocese_id);
    districtsByDiocese.set(id, (districtsByDiocese.get(id) ?? 0) + 1);
  }

  const parishesByDiocese = new Map<string, number>();
  for (const org of orgRows ?? []) {
    const district = org.districts as { diocese_id?: string } | null;
    const dioceseId = String(district?.diocese_id ?? "");
    if (dioceseId) {
      parishesByDiocese.set(dioceseId, (parishesByDiocese.get(dioceseId) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dayosisi</h1>
          <p className="text-sm text-muted-foreground">Regional hierarchy — top level.</p>
        </div>
        <Button asChild>
          <Link href="/platform/dioceses/new">Add dayosisi</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All dayosisi</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="text-right">Jimbo</TableHead>
                <TableHead className="text-right">Parishes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(dioceses ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No dayosisi yet.
                  </TableCell>
                </TableRow>
              ) : (
                (dioceses ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="font-mono text-xs">{d.code}</TableCell>
                    <TableCell className="text-right">
                      {districtsByDiocese.get(d.id) ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {parishesByDiocese.get(d.id) ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/platform/districts?diocese=${d.id}`}>View jimbo</Link>
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
