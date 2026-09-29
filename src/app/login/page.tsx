import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { readOrgAuthMode, type OrgAuthMode } from "@/lib/platform/org-auth-mode";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ parish?: string }>;
}) {
  const { parish: parishSlug } = await searchParams;

  let authMode: OrgAuthMode = "email";
  let parishName: string | undefined;

  if (parishSlug) {
    const supabase = await createClient();
    const { data: rows } = await supabase.rpc("get_parish_public_by_slug", {
      _slug: parishSlug,
    });
    if (rows?.length) {
      const row = rows[0] as { display_name?: string | null; auth_mode?: OrgAuthMode };
      parishName = row.display_name ?? parishSlug;
      authMode = row.auth_mode ?? readOrgAuthMode(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{parishName ? `Sign in — ${parishName}` : "Sign in"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="text-sm text-muted-foreground" aria-live="polite">
                Loading sign-in…
              </div>
            }
          >
            <LoginForm parishSlug={parishSlug} parishName={parishName} authMode={authMode} />
          </Suspense>
        </CardContent>
        <CardFooter className="flex justify-center text-center text-sm text-muted-foreground">
          <p>
            New member?{" "}
            <Link
              href={parishSlug ? `/join/${parishSlug}` : "/join"}
              className="underline underline-offset-4"
            >
              Create account
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
