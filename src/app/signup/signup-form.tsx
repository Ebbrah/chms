"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Eye, EyeOff, Loader2 } from "lucide-react";

type SignupFormProps = {
  parishSlug?: string;
  parishName?: string;
  redirectPath?: string;
};

export function SignupForm({
  parishSlug,
  parishName,
  redirectPath = "/login",
}: SignupFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasOfferingNumber, setHasOfferingNumber] = useState<"yes" | "no" | "">("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!parishSlug) {
      setError("Registration requires a parish join link from your church.");
      return;
    }
    if (!hasOfferingNumber) {
      setError("Please indicate whether you have an offering number.");
      return;
    }
    setError(null);
    setMessage(null);
    setSubmitted(false);
    setLoading(true);
    const form = e.currentTarget;
    const email = (
      (form.elements.namedItem("email") as HTMLInputElement).value ?? ""
    )
      .trim()
      .toLowerCase();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const fullName = (
      (form.elements.namedItem("fullName") as HTMLInputElement).value ?? ""
    ).trim();
    const phone = (form.elements.namedItem("phone") as HTMLInputElement)?.value ?? "";
    const offeringNumber =
      hasOfferingNumber === "yes"
        ? ((form.elements.namedItem("offeringNumber") as HTMLInputElement)?.value ?? "").trim()
        : "";
    if (hasOfferingNumber === "yes" && !offeringNumber) {
      setLoading(false);
      setError("Please enter your offering number.");
      return;
    }
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}${redirectPath}` : undefined;
    const supabase = createClient();
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: fullName,
          phone: phone.trim() || null,
          offering_number: offeringNumber || null,
          parish_slug: parishSlug,
        },
      },
    });
    if (err) {
      setLoading(false);
      setError(err.message);
      return;
    }
    setLoading(false);
    form.reset();
    setHasOfferingNumber("");
    setSubmitted(true);
    setMessage(
      parishName
        ? `Check your email to confirm your ${parishName} account, then sign in.${
            hasOfferingNumber === "no"
              ? " After sign-in you will complete your member profile."
              : ""
          }`
        : "Check your email to confirm your account, then sign in.",
    );
    router.refresh();
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertTitle>Almost there</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="fullName">Jina Kamili</Label>
        <Input id="fullName" name="fullName" required autoComplete="name" />
      </div>
      <div className="grid gap-2">
        <Label>Je, una namba ya bahasha (offering number)?</Label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="hasOfferingNumber"
              value="yes"
              checked={hasOfferingNumber === "yes"}
              onChange={() => setHasOfferingNumber("yes")}
            />
            Ndio
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="hasOfferingNumber"
              value="no"
              checked={hasOfferingNumber === "no"}
              onChange={() => setHasOfferingNumber("no")}
            />
            Hapana
          </label>
        </div>
      </div>
      {hasOfferingNumber === "yes" ? (
        <div className="grid gap-2">
          <Label htmlFor="offeringNumber">Namba ya Bahasha</Label>
          <Input id="offeringNumber" name="offeringNumber" autoComplete="off" required />
        </div>
      ) : null}
      {hasOfferingNumber === "no" ? (
        <p className="text-sm text-muted-foreground">
          You can register now without an offering number. After email verification and sign-in,
          you will complete your member profile and wait for parish approval.
        </p>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="phone">Namba ya Simu</Label>
        <Input id="phone" name="phone" autoComplete="tel" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            className="pr-10"
            required
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <Button type="submit" disabled={loading || submitted || !parishSlug} aria-busy={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating account...
          </>
        ) : submitted ? (
          "Account request sent"
        ) : (
          "Create account"
        )}
      </Button>
    </form>
  );
}
