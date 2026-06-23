import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/platform-guard";
import { HierarchyFilter } from "@/components/platform/hierarchy-filter";
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

export default async function DistrictsListPage({
  searchParams,
}: {
  searchParams: Promise<{ diocese?: string }>;
}) {
  await requirePlatformAdmin();
  const { diocese: dioceseFilter } = await searchParams;
  const supabase = await createClient();

  const [{ data: dioceses }, { data: districtsRaw }, { data: orgRows }] = await Promise.all([
    supabase.from("dioceses").select("id, name").order("name"),
    supabase
      .from("districts")
      .select("id, name, code, diocese_id, dioceses ( name )")
      .order("name"),
    supabase.from("organizations").select("district_id"),
  ]);

  const parishesByDistrict = new Map<string, number>();
  for (const org of orgRows ?? []) {
    const id = String(org.district_id ?? "");
    if (id) parishesByDistrict.set(id, (parishesByDistrict.get(id) ?? 0) + 1);
  }

  const districts = (districtsRaw ?? []).filter((d) =>
    dioceseFilter ? d.diocese_id === dioceseFilter : true,
  );

  const districtOptions = (districtsRaw ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    diocese_id: d.diocese_id,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jimbo</h1>
          <p className="text-sm text-muted-foreground">
            Jimbo belong to a dayosisi and contain parishes.
          </p>
        </div>
        <Button asChild>
          <Link
            href={
              dioceseFilter
                ? `/platform/districts/new?diocese=${dioceseFilter}`
                : "/platform/districts/new"
            }
          >
            Add jimbo
          </Link>
        </Button>
      </div>

      <Suspense fallback={null}>
        <HierarchyFilter
          dioceses={dioceses ?? []}
          districts={districtOptions}
          showDistrict={false}
        />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {dioceseFilter ? "Filtered jimbo" : "All jimbo"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jimbo</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Dayosisi</TableHead>
                <TableHead className="text-right">Parishes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {districts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No jimbo match this filter.
                  </TableCell>
                </TableRow>
              ) : (
                districts.map((d) => {
                  const diocese = d.dioceses as { name?: string } | null;
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="font-mono text-xs">{d.code}</TableCell>
                      <TableCell>{diocese?.name ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {parishesByDistrict.get(d.id) ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/platform/parishes?district=${d.id}`}>View parishes</Link>
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
