import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { headers } from "next/headers";
import { getMemberRegistrationState, shouldShowCompleteRegistration } from "@/lib/members/registration-state";
import { CompleteRegistrationAlert } from "@/components/members/complete-registration-cta";

/** Shared dashboard banner — one cached registration read for all dashboard routes. */
export async function RegistrationStatusBanner() {
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname === "/dashboard/complete-registration") {
    return null;
  }

  const registrationState = await getMemberRegistrationState();

  return (
    <div className="space-y-4 pb-4">
      {shouldShowCompleteRegistration(registrationState) ? <CompleteRegistrationAlert /> : null}
      {registrationState?.kind === "pending_approval" ? (
        <Alert>
          <AlertTitle>Waiting for offering number</AlertTitle>
          <AlertDescription>
            Your registration is pending parish approval. You can view and edit your profile while
            you wait (name, offering number, and pledges remain parish-managed).
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
