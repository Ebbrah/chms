import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyRoles, getProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmountTZS } from "@/lib/format/amount";
import { toDisplayCaps } from "@/lib/format/name";
import { canPastoral, hasRole } from "@/lib/auth/permissions";
import { CongregationNotesCard } from "./congregation-notes-card";
import { loadChairProfileForHousehold, loadEldersForHousehold } from "@/lib/members/household-leaders";

export default async function DashboardHomePage() {
  const profile = await getProfile();
  const roles = await getMyRoles();
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();
  const { data: member } = profile?.id
    ? await supabase
        .from("members")
        .select("id, offering_number, status, member_details, household_id")
        .eq("user_id", profile.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const details =
    member?.member_details && typeof member.member_details === "object"
      ? (member.member_details as Record<string, string>)
      : null;
  const avatarUrl = details?.passport_photo_url ?? profile?.avatar_url ?? null;

  const { data: household } = member?.household_id
    ? await supabase
        .from("households")
        .select("name, chairperson_user_id")
        .eq("id", String(member.household_id))
        .maybeSingle()
    : { data: null };

  const roleUsers = await supabase
    .from("user_roles")
    .select("role, user_id")
    .in("role", ["pastor", "assistant_pastor"]);
  const roleUserIds = Array.from(new Set((roleUsers.data ?? []).map((r) => String(r.user_id ?? "")).filter(Boolean)));
  const roleProfiles = roleUserIds.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", roleUserIds)
    : { data: [] };
  const profileById = new Map((roleProfiles.data ?? []).map((p) => [String(p.id), p]));
  const pastorId = (roleUsers.data ?? []).find((r) => r.role === "pastor")?.user_id ?? null;
  const assistantPastorId = (roleUsers.data ?? []).find((r) => r.role === "assistant_pastor")?.user_id ?? null;
  const pastor = pastorId ? profileById.get(String(pastorId)) : null;
  const assistantPastor = assistantPastorId ? profileById.get(String(assistantPastorId)) : null;
  const elders = await loadEldersForHousehold(supabase, member?.household_id ?? null);
  const chair = await loadChairProfileForHousehold(supabase, member?.household_id ?? null);

  const jumuiyaName = details?.jumuiya_name?.trim()
    ? details.jumuiya_name
    : household?.name ?? "Not assigned";

  const yearStartIso = `${currentYear}-01-01T00:00:00.000Z`;
  const yearEndIso = `${currentYear}-12-31T23:59:59.999Z`;
  const { data: myOfferings } = member?.id
    ? await supabase
        .from("offerings")
        .select("amount, received_at, offering_types(name)")
        .eq("member_id", member.id)
        .gte("received_at", yearStartIso)
        .lte("received_at", yearEndIso)
        .limit(20000)
    : { data: null };

  const isPastor = hasRole(roles, "pastor");
  const isChair = hasRole(roles, "jumuiya_chairman");
  const isCommitteeHead = hasRole(roles, "committee_head");
  const { data: notesRows } = await supabase
    .from("congregation_notes")
    .select("id, title, body, created_at, author_user_id, household_id")
    .order("created_at", { ascending: false })
    .limit(20);
  const authorIds = Array.from(
    new Set((notesRows ?? []).map((n) => String(n.author_user_id ?? "")).filter(Boolean)),
  );
  const { data: authorProfiles } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] };
  const authorMap = new Map((authorProfiles ?? []).map((p) => [String(p.id), String(p.full_name ?? "")]));
  const notes = (notesRows ?? []).map((n) => ({
    id: String(n.id),
    title: String(n.title ?? ""),
    body: String(n.body ?? ""),
    created_at: String(n.created_at ?? ""),
    author_user_id: String(n.author_user_id ?? ""),
    author_name: authorMap.get(String(n.author_user_id ?? "")) ?? "Unknown",
    scope_label: n.household_id ? "Taarifa ya Jumuiya" : "Taarifa ya Kanisa",
  }));

  type OfferingAggRow = {
    amount: number | string;
    offering_types: { name?: string } | { name?: string }[] | null;
  };

  function typeName(v: unknown): string {
    if (!v) return "";
    if (Array.isArray(v)) return String((v[0] as { name?: string } | undefined)?.name ?? "");
    return String((v as { name?: string }).name ?? "");
  }
  function bucket(nm: string) {
    const n = nm.toLowerCase();
    if (n.includes("ahadi")) return "ahadi";
    if (n.includes("jengo")) return "jengo";
    if (n.includes("maendeleo") || n.includes("dayosisi")) return "dayosisi";
    return "other";
  }
  const given = { ahadi: 0, jengo: 0, dayosisi: 0 };
  for (const o of (myOfferings ?? []) as OfferingAggRow[]) {
    const t = bucket(typeName(o.offering_types));
    const amt = Number(o.amount);
    if (!Number.isFinite(amt)) continue;
    if (t === "ahadi") given.ahadi += amt;
    else if (t === "jengo") given.jengo += amt;
    else if (t === "dayosisi") given.dayosisi += amt;
  }

  function pledgeAmount(v: string | undefined): number {
    const n = Number(String(v ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }

  function pledgeDisplay(v: string | undefined): string {
    const n = pledgeAmount(v);
    if (!Number.isFinite(n) || n === 0) return v?.trim() ? v : "—";
    return formatAmountTZS(n);
  }

  const { data: otherPledgeRows } = member?.id
    ? await supabase
        .from("member_other_pledges")
        .select("pledge_date, title, amount, paid_amount, full_name")
        .eq("member_id", member.id)
        .order("pledge_date", { ascending: false })
        .limit(50)
    : { data: null };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        </div>
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt="User profile"
            width={64}
            height={64}
            className="h-16 w-16 rounded-full border object-cover"
          />
        ) : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your roles</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {roles.length === 0 ? (
            <span className="text-sm text-muted-foreground">No roles loaded.</span>
          ) : (
            roles.map((r) => (
              <Badge key={r} variant="secondary">
                {toDisplayCaps(r.replaceAll("_", " "))}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your member details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>
              Offering number: <strong>{member?.offering_number ?? "Pending assignment"}</strong>
            </p>
            <p>
              Status: <strong>{member?.status ?? "pending_profile"}</strong>
            </p>
            <p>Jumuiya: {toDisplayCaps(jumuiyaName)}</p>
            <p>Occupation: {toDisplayCaps(details?.occupation ?? "—")}</p>
            <p>
              Pastor: <strong>{toDisplayCaps(String(pastor?.full_name ?? "—"))}</strong> ({String(pastor?.phone ?? "—")})
            </p>
            <p>
              Assistant pastor:{" "}
              <strong>{toDisplayCaps(String(assistantPastor?.full_name ?? "—"))}</strong> (
              {String(assistantPastor?.phone ?? "—")})
            </p>
            <p>
              Mzee wa kanisa 1: <strong>{toDisplayCaps(String(elders[0]?.full_name ?? "—"))}</strong> (
              {String(elders[0]?.phone ?? "—")})
            </p>
            <p>
              Mzee wa kanisa 2: <strong>{toDisplayCaps(String(elders[1]?.full_name ?? "—"))}</strong> (
              {String(elders[1]?.phone ?? "—")})
            </p>
            <p>
              Mwenyekiti wa Jumuiya: <strong>{toDisplayCaps(String(chair?.full_name ?? "—"))}</strong> (
              {String(chair?.phone ?? "—")})
            </p>
          </CardContent>
        </Card>
        <CongregationNotesCard
          notes={notes}
          canPostGlobal={isPastor || isCommitteeHead}
          canPostJumuiya={isChair}
          currentUserId={profile?.id ?? null}
          canModerateNotes={hasRole(roles, "admin") || canPastoral(roles)}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Annual pledges ({currentYear})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Pledged</TableHead>
                <TableHead className="text-right">Given</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Ahadi</TableCell>
                <TableCell className="text-right">{pledgeDisplay(details?.pledge_1)}</TableCell>
                <TableCell className="text-right">{formatAmountTZS(given.ahadi)}</TableCell>
                <TableCell className="text-right">
                  {formatAmountTZS(pledgeAmount(details?.pledge_1) - given.ahadi)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Jengo</TableCell>
                <TableCell className="text-right">{pledgeDisplay(details?.pledge_2)}</TableCell>
                <TableCell className="text-right">{formatAmountTZS(given.jengo)}</TableCell>
                <TableCell className="text-right">
                  {formatAmountTZS(pledgeAmount(details?.pledge_2) - given.jengo)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Dayosisi</TableCell>
                <TableCell className="text-right">{pledgeDisplay(details?.pledge_3)}</TableCell>
                <TableCell className="text-right">{formatAmountTZS(given.dayosisi)}</TableCell>
                <TableCell className="text-right">
                  {formatAmountTZS(pledgeAmount(details?.pledge_3) - given.dayosisi)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Other pledges</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(otherPledgeRows ?? []).length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Pledged</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(otherPledgeRows ?? []).map((o, i) => {
                  const pledged = Number(o.amount ?? 0);
                  const paid = Number((o as { paid_amount?: number | null }).paid_amount ?? 0);
                  const balance = pledged - paid;
                  return (
                    <TableRow key={`${String(o.pledge_date)}-${i}`}>
                      <TableCell>{String(o.pledge_date)}</TableCell>
                      <TableCell>{String(o.title ?? "")}</TableCell>
                      <TableCell className="text-right">{formatAmountTZS(pledged)}</TableCell>
                      <TableCell className="text-right">{formatAmountTZS(paid)}</TableCell>
                      <TableCell className="text-right">{formatAmountTZS(balance)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="px-4 py-4 text-sm text-muted-foreground">—</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
