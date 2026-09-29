"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import type { OrgAuthMode } from "@/lib/platform/org-auth-mode";
import { orgAllowsEmailAuth, orgAllowsWhatsappAuth } from "@/lib/platform/org-auth-mode";
import { AuthMethodPicker, type AuthMethod } from "@/components/auth/auth-method-picker";
import { WhatsappOtpAuth } from "@/components/auth/whatsapp-otp-auth";

type LoginFormProps = {
  parishSlug?: string;
  parishName?: string;
  authMode?: OrgAuthMode;
};

export function LoginForm({ parishSlug, parishName, authMode = "email" }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [method, setMethod] = useState<AuthMethod>(() =>
    orgAllowsWhatsappAuth(authMode) && !orgAllowsEmailAuth(authMode) ? "whatsapp" : "email",
  );

  const errorFromQuery = searchParams.get("error");
  const resolvedError = error ?? errorFromQuery;

  const whatsappRequiresParish = orgAllowsWhatsappAuth(authMode) && !parishSlug;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (err) {
      setLoading(false);
      setError(err.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (whatsappRequiresParish && method === "whatsapp") {
    return (
      <Alert>
        <AlertTitle>Parish link required</AlertTitle>
        <AlertDescription>
          WhatsApp sign-in uses your parish join link. Open the link from your church, or{" "}
          <Link href="/join" className="underline">
            find your parish
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4">
      <AuthMethodPicker mode={authMode} value={method} onChange={setMethod} />

      {method === "whatsapp" && parishSlug ? (
        <WhatsappOtpAuth
          parishSlug={parishSlug}
          parishName={parishName}
          purpose="login"
          onBack={orgAllowsEmailAuth(authMode) ? () => setMethod("email") : undefined}
        />
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
          {resolvedError ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{resolvedError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="pr-10"
                required
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
            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground underline underline-offset-4"
              >
                Forgot password?
              </Link>
            </div>
          </div>
          <Button type="submit" disabled={loading} aria-busy={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
