import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/platform-guard";
import { NewParishForm } from "./new-parish-form";

export default async function NewParishPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();

  const [{ data: dioceses }, { data: districts }] = await Promise.all([
    supabase.from("dioceses").select("id, name, code").order("name"),
    supabase.from("districts").select("id, diocese_id, name, code").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add parish</h1>
        <p className="text-sm text-muted-foreground">
          Creates a fully seeded empty parish via provision_parish().
        </p>
      </div>
      <NewParishForm dioceses={dioceses ?? []} districts={districts ?? []} />
    </div>
  );
}
