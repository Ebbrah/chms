import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports & export</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members (Excel)</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/api/export/members" target="_blank" rel="noreferrer">
                Download .xlsx
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offerings (Excel)</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/api/export/offerings" target="_blank" rel="noreferrer">
                Download .xlsx
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members directory (PDF)</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/api/reports/members-pdf" target="_blank" rel="noreferrer">
                Download .pdf
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
