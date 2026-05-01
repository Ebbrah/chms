import { redirect } from "next/navigation";
import Link from "next/link";
import { MemberProfileReport } from "@/components/members/member-profile-report";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";

export default async function MyProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/change-password">Change password</Link>
        </Button>
      </div>
      {MemberProfileReport({
        profileId: user.id,
        canEdit: false,
        backHref: "/dashboard",
      })}
    </div>
  );
}
