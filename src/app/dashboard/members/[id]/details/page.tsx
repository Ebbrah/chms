import { notFound } from "next/navigation";
import { MemberProfileReport } from "@/components/members/member-profile-report";

export default async function MemberDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await MemberProfileReport({
    profileId: id,
    canEdit: true,
    backHref: "/dashboard/members",
  });
  if (!report) notFound();
  return report;
}
