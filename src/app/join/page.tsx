import Link from "next/link";
import { redirect } from "next/navigation";
import { getParishJoinOptions } from "@/lib/platform/parish-join-options";
import { ParishJoinPicker } from "@/app/join/parish-join-picker";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getSingleParishJoinSlug,
  isSingleParishDeployment,
} from "@/lib/deployment";

export default async function JoinPickerPage() {
  if (isSingleParishDeployment()) {
    const slug = getSingleParishJoinSlug();
    if (slug) redirect(`/join/${slug}`);
  }

  const options = await getParishJoinOptions();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Jisajili Katika Mfumo wa Usharika</CardTitle>
          <p className="text-sm text-muted-foreground">
            Chagua dayosisi, jimbo, na usharika wako ili kuendelea na usajili.
          </p>
        </CardHeader>
        <CardContent>
          {options.parishes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Hakuna usharika unaopatikana kwa sasa. Wasiliana na ofisi ya Usharika kupata URL
              sahihi ya kujiunga.
            </p>
          ) : (
            <ParishJoinPicker options={options} />
          )}
        </CardContent>
        <CardFooter className="flex justify-center text-sm text-muted-foreground">
          <Link href="/login" className="underline underline-offset-4">
            Tayari una akaunti? Ingia (Login)
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
