import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/platform-guard";
import { NewDioceseForm } from "./new-diocese-form";

export default async function NewDiocesePage() {
  await requirePlatformAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add dayosisi</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/platform/dioceses" className="underline underline-offset-4">
            ← Back to dayosisi
          </Link>
        </p>
      </div>
      <NewDioceseForm />
    </div>
  );
}
