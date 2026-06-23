import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/platform-guard";
import { NewDistrictForm } from "./new-district-form";

export default async function NewDistrictPage({
  searchParams,
}: {
  searchParams: Promise<{ diocese?: string }>;
}) {
  await requirePlatformAdmin();
  const { diocese: defaultDioceseId } = await searchParams;
  const supabase = await createClient();
  const { data: dioceses } = await supabase.from("dioceses").select("id, name").order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add jimbo</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/platform/districts" className="underline underline-offset-4">
            ← Back to jimbo
          </Link>
        </p>
      </div>
      <NewDistrictForm dioceses={dioceses ?? []} defaultDioceseId={defaultDioceseId} />
    </div>
  );
}
