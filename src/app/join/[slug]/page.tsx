import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "@/app/signup/signup-form";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { readOrgAuthMode, type OrgAuthMode } from "@/lib/platform/org-auth-mode";

type ParishPublic = {
  id: string;
  display_name: string | null;
  slug: string | null;
  logo_url: string | null;
  status: string;
  auth_mode?: OrgAuthMode;
};

export default async function JoinParishPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: rows, error } = await supabase.rpc("get_parish_public_by_slug", {
    _slug: slug,
  });

  if (error || !rows?.length) notFound();

  const parish = rows[0] as ParishPublic;
  const parishName = parish.display_name ?? slug;
  const authMode = parish.auth_mode ?? readOrgAuthMode(null);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {parish.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={parish.logo_url}
              alt=""
              className="mx-auto mb-3 h-16 w-16 rounded-lg border object-cover"
            />
          ) : null}
          <CardTitle>Jiunge na {parishName}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Create your member account for this parish.
          </p>
        </CardHeader>
        <CardContent>
          <SignupForm parishSlug={slug} parishName={parishName} authMode={authMode} />
        </CardContent>
        <CardFooter className="flex justify-center text-sm text-muted-foreground">
          <Link href={`/login?parish=${slug}`} className="underline underline-offset-4">
            Already have an account? Sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
