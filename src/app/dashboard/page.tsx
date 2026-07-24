import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getMyRoles } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  loadSignedInMemberContext,
  shouldShowCompleteRegistration,
} from "@/lib/members/registration-state";
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
import { loadMemberYearlyPledgeTotals } from "@/lib/members/pledge-totals";
import { sanitizeMemberDetailsForDisplay } from "@/lib/members/sanitize-member-details";
import { RegistrationProcessingNotice } from "@/components/members/registration-processing-notice";
import { DashboardAvatarUploader } from "./dashboard-avatar-uploader";

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams: Promise<{ registration?: string }>;
}) {
  const [{ registration }, roles, memberContext, supabase] = await Promise.all([
    searchParams,
    getMyRoles(),
    loadSignedInMemberContext(),
    createClient(),
  ]);

  const profile = memberContext?.profile ?? null;
  const member = memberContext?.member ?? null;
  const registrationState = memberContext?.registrationState ?? null;
  const orgId = memberContext?.orgId ?? null;
  const details = sanitizeMemberDetailsForDisplay(member?.member_details) as Record<
    string,
    string | undefined
  >;
  const avatarUrl =
    details.passport_photo_url?.trim() ||
    (profile as { avatar_url?: string | null } | null)?.avatar_url ||
    null;
  const parishOrgId = orgId;

  // Minimal dashboard only when there is genuinely no member row yet.
  if (shouldShowCompleteRegistration(registrationState) && !member?.id) {
    const showRegistrationProcessing =
      registration === "submitted" && registrationState?.kind === "needs_onboarding";

    return (
      <div className="space-y-6">
        {showRegistrationProcessing ? (
          <RegistrationProcessingNotice pollWhileProcessing />
        ) : registration === "submitted" ? (
          <Alert>
            <AlertTitle>Registration submitted</AlertTitle>
            <AlertDescription>
              Your member profile has been submitted. The parish will review and assign your offering
              number.
            </AlertDescription>
          </Alert>
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete your member profile using the prompt above to unlock your full dashboard.
          </p>
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
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const householdId = member?.household_id ?? null;

  const [
    householdResult,
    roleUsersResult,
    elders,
    chair,
    pledgeTotals,
    notesRowsResult,
    otherPledgeRowsResult,
  ] = await Promise.all([
    householdId
      ? supabase
          .from("households")
          .select("name, chairperson_user_id")
          .eq("id", String(householdId))
          .maybeSingle()
      : Promise.resolve({ data: null }),
    parishOrgId
      ? supabase
          .from("user_roles")
          .select("role, user_id")
          .in("role", ["pastor", "assistant_pastor"])
          .eq("org_id", parishOrgId)
          .limit(4)
      : Promise.resolve({ data: [] as { role: string; user_id: string }[] }),
    loadEldersForHousehold(supabase, householdId),
    loadChairProfileForHousehold(supabase, householdId),
    member?.id
      ? loadMemberYearlyPledgeTotals(supabase, member.id, currentYear)
      : Promise.resolve({ ahadi: 0, jengo: 0, dayosisi: 0 }),
    supabase
      .from("congregation_notes")
      .select("id, title, body, image_url, created_at, author_user_id, household_id")
      .order("created_at", { ascending: false })
      .limit(20),
    member?.id
      ? supabase
          .from("member_other_pledges")
          .select("pledge_date, title, amount, paid_amount, full_name")
          .eq("member_id", member.id)
          .order("pledge_date", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: null }),
  ]);

  const household = householdResult.data;
  const roleUserIds = Array.from(
    new Set((roleUsersResult.data ?? []).map((r) => String(r.user_id ?? "")).filter(Boolean)),
  );
  const { data: roleProfiles } = roleUserIds.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", roleUserIds)
    : { data: [] };
  const profileById = new Map((roleProfiles ?? []).map((p) => [String(p.id), p]));
  const pastorId = (roleUsersResult.data ?? []).find((r) => r.role === "pastor")?.user_id ?? null;
  const assistantPastorId =
    (roleUsersResult.data ?? []).find((r) => r.role === "assistant_pastor")?.user_id ?? null;
  const pastor = pastorId ? profileById.get(String(pastorId)) : null;
  const assistantPastor = assistantPastorId ? profileById.get(String(assistantPastorId)) : null;

  const jumuiyaName = details?.jumuiya_name?.trim()
    ? details.jumuiya_name
    : household?.name ?? "Not assigned";

  const notesRows = notesRowsResult.data;
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
    image_url: n.image_url ? String(n.image_url) : null,
    created_at: String(n.created_at ?? ""),
    author_user_id: String(n.author_user_id ?? ""),
    author_name: authorMap.get(String(n.author_user_id ?? "")) ?? "Unknown",
    scope_label: n.household_id ? "Taarifa ya Jumuiya" : "Taarifa ya Kanisa",
  }));

  const given = pledgeTotals;
  const otherPledgeRows = otherPledgeRowsResult.data;

  function pledgeAmount(v: string | undefined): number {
    const n = Number(String(v ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }

  function pledgeDisplay(v: string | undefined): string {
    const n = pledgeAmount(v);
    if (!Number.isFinite(n) || n === 0) return v?.trim() ? v : "—";
    return formatAmountTZS(n);
  }

  const isPastor = hasRole(roles, "pastor");
  const isChair = hasRole(roles, "jumuiya_chairman");
  const isCommitteeHead = hasRole(roles, "committee_head");

  const memberStatusLabel =
    registrationState?.kind === "pending_approval"
      ? "Pending parish approval"
      : registrationState?.kind === "active"
        ? "Active"
        : (member?.status ?? "pending_profile");
  const showRegistrationSubmittedNotice =
    registration === "submitted" && registrationState?.kind !== "active";
  const showRegistrationProcessing =
    registration === "submitted" && registrationState?.kind === "needs_onboarding";

  return (
    <div className="space-y-6">
      {showRegistrationProcessing ? (
        <RegistrationProcessingNotice pollWhileProcessing />
      ) : showRegistrationSubmittedNotice ? (
        <Alert>
          <AlertTitle>Registration submitted</AlertTitle>
          <AlertDescription>
            Your member profile has been submitted. The parish will review and assign your offering number.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        </div>
        <DashboardAvatarUploader avatarUrl={avatarUrl} />
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
              Status: <strong>{memberStatusLabel}</strong>
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
