import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="text-sm text-muted-foreground" aria-live="polite">
                Loading sign-in…
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </CardContent>
        <CardFooter className="flex justify-center text-center text-sm text-muted-foreground">
          <p>
            New member?{" "}
            <Link href="/join" className="underline underline-offset-4">
              Create account
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
