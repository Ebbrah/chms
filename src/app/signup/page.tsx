import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Parish registration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Wasiliana na ofisi ya Usharika kupata URL sahihi ya kujiunga. Ask your parish
            administrator for the correct URL.
          </p>
          <p>
            <Link href="/join" className="font-medium text-foreground underline underline-offset-4">
              Create account
            </Link>{" "}
            — chagua dayosisi, jimbo, na usharika wako.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center text-sm">
          <Link href="/login" className="underline underline-offset-4">
            Go to sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
