import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/platform-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ParishDetailClient } from "./parish-detail-client";

export default async function ParishDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const { created } = await searchParams;
  const supabase = await createClient();

  const { data: parish } = await supabase
    .from("organizations")
    .select(
      `
      id,
      display_name,
      name,
      slug,
      status,
      logo_url,
      timezone,
      settings,
      fiscal_year_start_month,
      districts (
        name,
        dioceses ( name )
      )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (!parish) notFound();

  const { data: operators } = await supabase
    .from("platform_parish_operators")
    .select("id, user_id, profiles ( full_name, email )")
    .eq("org_id", id);

  const district = parish.districts as {
    name?: string;
    dioceses?: { name?: string };
  } | null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {parish.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={parish.logo_url}
              alt=""
              className="h-14 w-14 rounded-lg border object-cover"
            />
          ) : null}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {parish.display_name ?? parish.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {district?.dioceses?.name} / {district?.name} · {parish.timezone}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {parish.slug}
              </Badge>
              <Badge>{parish.status}</Badge>
            </div>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/platform/parishes">← All parishes</Link>
        </Button>
      </div>

      <ParishDetailClient
        orgId={parish.id}
        slug={parish.slug}
        status={String(parish.status ?? "active")}
        settings={parish.settings}
        operators={(operators ?? []) as Parameters<typeof ParishDetailClient>[0]["operators"]}
        created={created === "1"}
      />
    </div>
  );
}
