"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendWhatsappAuthOtp, verifyWhatsappAuthOtp } from "@/lib/actions/whatsapp-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

type WhatsappOtpAuthProps = {
  parishSlug: string;
  parishName?: string;
  purpose: "login" | "signup";
  signupFields?: {
    fullName: string;
    offeringNumber?: string | null;
    contactEmail?: string | null;
  };
  onBack?: () => void;
};

export function WhatsappOtpAuth({
  parishSlug,
  parishName,
  purpose,
  signupFields,
  onBack,
}: WhatsappOtpAuthProps) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await sendWhatsappAuthOtp({
      parishSlug,
      phone,
      purpose,
      metadata: signupFields,
    });
    setLoading(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setStep("code");
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await verifyWhatsappAuthOtp({
      parishSlug,
      phone,
      code,
      purpose,
      signup: purpose === "signup" ? signupFields : undefined,
    });
    setLoading(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {step === "phone" ? (
        <form onSubmit={(e) => void requestCode(e)} className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            {parishName
              ? `We will send a one-time code to your WhatsApp number for ${parishName}.`
              : "We will send a one-time code to your WhatsApp number."}
          </p>
          <div className="grid gap-2">
            <Label htmlFor="wa-phone">Namba ya Simu (WhatsApp)</Label>
            <Input
              id="wa-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712 345 678"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {onBack ? (
              <Button type="button" variant="outline" onClick={onBack}>
                Back
              </Button>
            ) : null}
            <Button type="submit" disabled={loading} aria-busy={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send WhatsApp code"
              )}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={(e) => void submitCode(e)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="wa-code">Code from WhatsApp</Label>
            <Input
              id="wa-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("phone")}>
              Change number
            </Button>
            <Button type="submit" disabled={loading} aria-busy={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                purpose === "login" ? "Sign in" : "Create account"
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
