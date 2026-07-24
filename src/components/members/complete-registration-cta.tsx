import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Shared CTA for users who still need the parish registration form (no offering number yet). */
export function CompleteRegistrationAlert() {
  return (
    <Alert>
      <AlertTitle>Complete your member registration</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          Welcome! Please fill in your member profile so the parish can review and assign your
          offering number.
        </p>
        <Button asChild size="sm">
          <Link href="/dashboard/complete-registration">Complete registration</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
