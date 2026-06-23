import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/platform-guard";
import { HierarchyFilter } from "@/components/platform/hierarchy-filter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ParishesListPage({
  searchParams,
}: {
  searchParams: Promise<{ diocese?: string; district?: string }>;
}) {
  await requirePlatformAdmin();
  const { diocese: dioceseFilter, district: districtFilter } = await searchParams;
  const supabase = await createClient();

  const [{ data: dioceses }, { data: districts }, { data: parishesRaw }] = await Promise.all([
    supabase.from("dioceses").select("id, name").order("name"),
    supabase.from("districts").select("id, name, diocese_id").order("name"),
    supabase
      .from("organizations")
      .select(
        `
      id,
      display_name,
      name,
      slug,
      status,
      district_id,
      districts (
        id,
        name,
        diocese_id,
        dioceses ( id, name )
      )
    `,
      )
      .order("display_name"),
  ]);

  let parishes = parishesRaw ?? [];

  if (districtFilter) {
    parishes = parishes.filter((p) => p.district_id === districtFilter);
  } else if (dioceseFilter) {
    parishes = parishes.filter((p) => {
      const district = p.districts as { diocese_id?: string } | null;
      return district?.diocese_id === dioceseFilter;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Parishes</h1>
          <p className="text-sm text-muted-foreground">Manage parish lifecycle and settings.</p>
        </div>
        <Button asChild>
          <Link href="/platform/parishes/new">Add parish</Link>
        </Button>
      </div>

      <Suspense fallback={null}>
        <HierarchyFilter dioceses={dioceses ?? []} districts={districts ?? []} />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {districtFilter || dioceseFilter ? "Filtered parishes" : "All parishes"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Dayosisi / Jimbo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {parishes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No parishes match this filter.
                  </TableCell>
                </TableRow>
              ) : (
                parishes.map((p) => {
                  const district = p.districts as {
                    name?: string;
                    dioceses?: { name?: string };
                  } | null;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.display_name ?? p.name}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.slug ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {district?.dioceses?.name ?? "—"} / {district?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={String(p.status ?? "active")} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/platform/parishes/${p.id}`}>Manage</Link>
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

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "active" ? "default" : status === "suspended" ? "destructive" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}
