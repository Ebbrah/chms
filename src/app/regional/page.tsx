import { redirect } from "next/navigation";
import { getRegionalEntryPath } from "@/lib/auth/regional-guard";

export default async function RegionalIndexPage() {
  redirect(await getRegionalEntryPath());
}
