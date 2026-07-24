import { notFound } from "next/navigation";
import { MemberProfileReport } from "@/components/members/member-profile-report";
import { loadMemberProfileReportData } from "@/lib/members/profile-report-data";

export default async function MemberDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loaded = await loadMemberProfileReportData(id);
  if (!loaded.ok) notFound();

  return (
    <MemberProfileReport profileId={id} canEdit backHref="/dashboard/members" initialData={loaded.data} />
  );
}
