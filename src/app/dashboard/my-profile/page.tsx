import { redirect } from "next/navigation";
import Link from "next/link";
import { MemberProfileReport } from "@/components/members/member-profile-report";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import {
  loadSignedInMemberContext,
  shouldLoadProfileReport,
  shouldShowCompleteRegistration,
} from "@/lib/members/registration-state";
import { loadMemberProfileReportData } from "@/lib/members/profile-report-data";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function MyProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const ctx = await loadSignedInMemberContext();
  const registrationState = ctx?.registrationState ?? null;
  const canEdit =
    registrationState?.kind === "active" || registrationState?.kind === "pending_approval";

  const needsRegistration = shouldShowCompleteRegistration(registrationState);
  const showReport = shouldLoadProfileReport(registrationState);
  const reportLoad = showReport ? await loadMemberProfileReportData(user.id) : null;
  const reportData = reportLoad?.ok ? reportLoad.data : null;
  const reportLoadFailed = reportLoad != null && !reportLoad.ok;

  return (
    <div className="space-y-4">
      {needsRegistration ? (
        <Alert>
          <AlertTitle>Complete registration required</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              You signed up without a parish offering number. Use the complete registration form to
              submit your member details and annual pledges; the parish will then assign your
              number.
            </p>
            <Button asChild size="sm">
              <Link href="/dashboard/complete-registration">Complete registration</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {registrationState?.kind === "no_member_record" ? (
        <Alert variant="destructive">
          <AlertTitle>Profile unavailable</AlertTitle>
          <AlertDescription>
            Your member record is incomplete. Please contact the parish office for assistance.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end gap-2">
        {canEdit ? (
          <Button asChild variant="default" size="sm">
            <Link href="/dashboard/my-profile/edit">Edit profile</Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/change-password">Change password</Link>
        </Button>
      </div>
      {reportLoadFailed ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load profile report</AlertTitle>
          <AlertDescription>
            Your session is valid but member data did not load. Refresh the page or try again in a
            moment.
          </AlertDescription>
        </Alert>
      ) : null}
      {showReport && !reportLoadFailed ? (
        <MemberProfileReport
          profileId={user.id}
          canEdit={false}
          backHref="/dashboard"
          initialData={reportData}
        />
      ) : registrationState === null ? (
        <Alert>
          <AlertTitle>Profile report unavailable</AlertTitle>
          <AlertDescription>
            Your session could not be verified. Try refreshing the page or signing out and back in.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
