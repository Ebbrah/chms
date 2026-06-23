import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SuspendedParishPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Parish suspended</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Your parish account is temporarily suspended. Contact the platform administrator
            for assistance.
          </p>
          <Button asChild variant="outline">
            <Link href="/login">Sign out</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
