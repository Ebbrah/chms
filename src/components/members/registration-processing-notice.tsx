"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ERROR_STORAGE_KEY = "registrationSubmitError";

type Props = {
  /** Poll the server while onboarding submit may still be running in the background. */
  pollWhileProcessing?: boolean;
};

/** Shown after optimistic redirect from complete-registration while the server action finishes. */
export function RegistrationProcessingNotice({ pollWhileProcessing = false }: Props) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(ERROR_STORAGE_KEY);
      if (stored) {
        setSubmitError(stored);
        sessionStorage.removeItem(ERROR_STORAGE_KEY);
      }
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  useEffect(() => {
    if (!pollWhileProcessing) return;

    const interval = window.setInterval(() => router.refresh(), 3000);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 60_000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [pollWhileProcessing, router]);

  if (submitError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Registration could not be saved</AlertTitle>
        <AlertDescription>{submitError}</AlertDescription>
      </Alert>
    );
  }

  if (!pollWhileProcessing) return null;

  return (
    <Alert>
      <AlertTitle>Saving your registration</AlertTitle>
      <AlertDescription>
        Your profile is being saved. This page will update automatically in a few seconds.
      </AlertDescription>
    </Alert>
  );
}

export function storeRegistrationSubmitError(message: string) {
  try {
    sessionStorage.setItem(ERROR_STORAGE_KEY, message);
  } catch {
    // sessionStorage unavailable
  }
}
