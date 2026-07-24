import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canManagePendingRegistrations } from "@/lib/members/registration-state";
import { Button } from "@/components/ui/button";
import {
  PendingRegistrationsTable,
  type PendingRegistrationRow,
} from "./pending-registrations-table";

export default async function PendingRegistrationsPage() {
  const canManage = await canManagePendingRegistrations();
  if (!canManage) redirect("/dashboard");

  const supabase = await createClient();
  const { data: pendingMembers } = await supabase
    .from("members")
    .select("id, user_id, email, phone, created_at, member_details")
    .eq("status", "pending_offering_number")
    .is("offering_number", null)
    .order("created_at", { ascending: false });

  const userIds = Array.from(
    new Set((pendingMembers ?? []).map((m) => String(m.user_id ?? "")).filter(Boolean)),
  );
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [String(p.id), p]));

  const rows: PendingRegistrationRow[] = (pendingMembers ?? []).map((m) => {
    const details =
      m.member_details && typeof m.member_details === "object"
        ? (m.member_details as Record<string, unknown>)
        : {};
    const userId = String(m.user_id ?? "");
    const profile = profileById.get(userId);
    return {
      id: String(m.id),
      userId,
      fullName: String(details.full_name ?? profile?.full_name ?? ""),
      email: String(m.email ?? profile?.email ?? ""),
      phone: String(m.phone ?? ""),
      createdAt: String(m.created_at ?? ""),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pending registrations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            New members who registered without an offering number. Approve to assign the next number automatically.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/members">Back to members</Link>
        </Button>
      </div>
      <PendingRegistrationsTable rows={rows} />
    </div>
  );
}
