import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatAmountTZS } from "@/lib/format/amount";
import { getMyRoles } from "@/lib/auth/session";
import {
  canApproveOfferingBatch,
  canAuthorizeOfferingBatch,
  canEditPendingOfferings,
  canManageOfferings,
  canRecordMidWeekOfferings,
  canRecordWeeklyOfferings,
  hasRole,
} from "@/lib/auth/permissions";
import { getChurchLocalDateISO, isChurchLocalSunday } from "@/lib/offering/church-calendar";
import {
  OFFERING_BATCH_SLOT_FIRST_SERVICE,
  OFFERING_BATCH_SLOT_MIDWEEK,
  isEnvelopeOfferingTypeName,
  offeringBatchSlotLabel,
} from "@/lib/offering/weekly";
import { OfferingTypeForm } from "./offering-type-form";
import { WeeklyOfferingGrid } from "./weekly-offering-grid";
import { WeeklyCollectiveOfferingForm } from "./weekly-collective-offering-form";
import { ApproveBatchButton } from "./approve-batch-button";
import { AuthorizeBatchButton } from "./authorize-batch-button";
import { RejectBatchButton } from "./reject-batch-button";
import { SectionTitleWithInfo } from "@/components/offerings/section-title-with-info";
import { OfferingAmountEditField } from "./offering-amount-edit-field";
import { OtherPledgesForm } from "./other-pledges-form";
import { OfferingsSectionScroll } from "@/components/offerings/offerings-section-scroll";
import { ButtonLink } from "@/components/ui/button-link";
import { matchesOfferingAmountSearch } from "@/lib/offering/table-search";

const OFFERINGS_SECTION_IDS = {
  registered: "registered-offerings",
  unregistered: "unregistered-offerings",
  collective: "other-offerings-preview",
  batches: "recent-batches",
} as const;

type OfferingsSectionId = (typeof OFFERINGS_SECTION_IDS)[keyof typeof OFFERINGS_SECTION_IDS];

function withOfferingsSection(path: string, section?: OfferingsSectionId) {
  if (!section) return path;
  const base = path.split("#")[0] ?? path;
  return `${base}#${section}`;
}

export default async function OfferingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    batchSearch?: string;
    batchStatus?: string;
    batchPage?: string;
    registeredBatchId?: string;
    regPage?: string;
    unregPage?: string;
    /** Filter registered offerings table by offering # or amount */
    regSearch?: string;
    /** Filter unregistered offerings by offering # snapshot */
    unregSearch?: string;
    collectivePage?: string;
    /** Filter other (collective) offerings by type name */
    collectiveSearch?: string;
  }>;
}) {
  const supabase = await createClient();
  const roles = await getMyRoles();
  const params = await searchParams;
  if (!canManageOfferings(roles)) redirect("/dashboard");

  const canRecord = canRecordWeeklyOfferings(roles);
  const canRecordMidWeek = canRecordMidWeekOfferings(roles);
  const canAuthorize = canAuthorizeOfferingBatch(roles);
  const canApprove = canApproveOfferingBatch(roles);
  const canEditOfferings = canEditPendingOfferings(roles);
  const batchSearch = String(params.batchSearch ?? "").trim();
  const batchStatus = String(params.batchStatus ?? "").trim();
  const parsedBatchPage = Number(params.batchPage ?? "1");
  const batchPage = Number.isFinite(parsedBatchPage) && parsedBatchPage > 0 ? Math.floor(parsedBatchPage) : 1;
  const batchPageSize = 5;
  const requestedRegisteredBatchId = String(params.registeredBatchId ?? "").trim();
  const offeringsTablePageSize = 15;
  const parsedRegPage = Number(params.regPage ?? "1");
  const regPage =
    Number.isFinite(parsedRegPage) && parsedRegPage > 0 ? Math.floor(parsedRegPage) : 1;
  const parsedUnregPage = Number(params.unregPage ?? "1");
  const unregPage =
    Number.isFinite(parsedUnregPage) && parsedUnregPage > 0 ? Math.floor(parsedUnregPage) : 1;
  const regSearchRaw = String(params.regSearch ?? "").trim();
  const unregSearchRaw = String(params.unregSearch ?? "").trim();
  const parsedCollectivePage = Number(params.collectivePage ?? "1");
  const collectivePage =
    Number.isFinite(parsedCollectivePage) && parsedCollectivePage > 0
      ? Math.floor(parsedCollectivePage)
      : 1;
  const collectiveSearchRaw = String(params.collectiveSearch ?? "").trim();
  const regSearchNorm = regSearchRaw.toLowerCase();
  const unregSearchNorm = unregSearchRaw.toLowerCase();
  const collectiveSearchNorm = collectiveSearchRaw.toLowerCase();
  const treasurerOnly =
    hasRole(roles, "treasurer") &&
    !hasRole(roles, "admin") &&
    !hasRole(roles, "committee_head") &&
    !hasRole(roles, "church_elder");

  let batchCountQuery = supabase
    .from("offering_week_batches")
    .select("id", { count: "exact", head: true });
  if (treasurerOnly) batchCountQuery = batchCountQuery.in("status", ["authorized", "approved"]);
  if (batchStatus && batchStatus !== "all") {
    batchCountQuery = batchCountQuery.eq("status", batchStatus);
  }
  if (batchSearch) {
    batchCountQuery = batchCountQuery.or(
      `week_start_date.ilike.%${batchSearch}%,week_end_date.ilike.%${batchSearch}%,status.ilike.%${batchSearch}%`,
    );
  }
  const { count: batchCount } = await batchCountQuery;
  const totalBatchPages = Math.max(1, Math.ceil(Number(batchCount ?? 0) / batchPageSize));
  const safeBatchPage = Math.min(batchPage, totalBatchPages);
  const batchFrom = (safeBatchPage - 1) * batchPageSize;
  const batchTo = batchFrom + batchPageSize - 1;

  let batchQuery = supabase
    .from("offering_week_batches")
    .select("id, week_start_date, week_end_date, status, created_at, affected_rows, batch_slot");
  if (treasurerOnly) batchQuery = batchQuery.in("status", ["authorized", "approved"]);
  if (batchStatus && batchStatus !== "all") {
    batchQuery = batchQuery.eq("status", batchStatus);
  }
  if (batchSearch) {
    batchQuery = batchQuery.or(
      `week_start_date.ilike.%${batchSearch}%,week_end_date.ilike.%${batchSearch}%,status.ilike.%${batchSearch}%`,
    );
  }
  const { data: batches } = await batchQuery
    .order("created_at", { ascending: false })
    .range(batchFrom, batchTo);

  const { data: offeringTypesRaw } = await supabase
    .from("offering_types")
    .select("id,name")
    .order("name");

  const selectedRegisteredBatchId = requestedRegisteredBatchId || String(batches?.[0]?.id ?? "");
  const { data: offerings } = selectedRegisteredBatchId
    ? await supabase
        .from("offerings")
        .select(
          "id, amount, currency, received_at, budget_posted, member_id, batch_id, offering_number_snapshot, offering_types(name), members(user_id, offering_number), offering_week_batches(status)",
        )
        .eq("batch_id", selectedRegisteredBatchId)
        .order("received_at", { ascending: false })
        // Keep this high enough for large weekly batches so newly added rows are visible.
        .limit(5000)
    : { data: [] };

  const collectiveOfferingTypes = (offeringTypesRaw ?? []).map((t) => ({
    id: t.id,
    name: t.name ?? "",
  }));

  type RegisteredRow = {
    key: string;
    dateLabel: string;
    offeringNumber: string;
    memberHref: string | null;
    ahadiAmount: number;
    jengoAmount: number;
    dayosisiAmount: number;
    ahadiOfferingId: string | null;
    jengoOfferingId: string | null;
    dayosisiOfferingId: string | null;
    editableAhadi: boolean;
    editableJengo: boolean;
    editableDayosisi: boolean;
    rowPosted: boolean;
  };

  type OtherOfferingRow = {
    key: string;
    offeringId: string;
    dateLabel: string;
    typeName: string;
    amount: number;
    editable: boolean;
    rowPosted: boolean;
  };

  type UnregisteredRow = {
    key: string;
    dateLabel: string;
    offeringNumber: string;
    ahadiAmount: number;
    jengoAmount: number;
    dayosisiAmount: number;
    ahadiOfferingId: string | null;
    jengoOfferingId: string | null;
    dayosisiOfferingId: string | null;
    editableAhadi: boolean;
    editableJengo: boolean;
    editableDayosisi: boolean;
    rowPosted: boolean;
  };

  const registeredMap = new Map<string, RegisteredRow>();
  const unregisteredMap = new Map<string, UnregisteredRow>();
  const otherOfferingsRowsUnfiltered: OtherOfferingRow[] = [];
  for (const o of offerings ?? []) {
    const otRaw = o.offering_types as { name?: string } | { name?: string }[] | null;
    const typeDisplayName = String((Array.isArray(otRaw) ? otRaw[0]?.name : otRaw?.name) ?? "");
    const otName = typeDisplayName.toLowerCase();
    const amount = Number(o.amount);
    if (!Number.isFinite(amount)) continue;
    const batch = o.offering_week_batches as { status?: string } | { status?: string }[] | null;
    const batchStatus = String((Array.isArray(batch) ? batch[0]?.status : batch?.status) ?? "");
    const editable =
      canEditOfferings &&
      !o.budget_posted &&
      (batchStatus === "pending_authorization" || batchStatus === "rejected");
    if (!o.member_id) {
      const snapshot = String((o as { offering_number_snapshot?: string }).offering_number_snapshot ?? "").trim();
      if (!snapshot) {
        if (!isEnvelopeOfferingTypeName(typeDisplayName)) {
          otherOfferingsRowsUnfiltered.push({
            key: String(o.id),
            offeringId: String(o.id),
            dateLabel: o.received_at ? new Date(String(o.received_at)).toLocaleString() : "—",
            typeName: typeDisplayName || "—",
            amount,
            editable,
            rowPosted: Boolean(o.budget_posted),
          });
        }
        continue;
      }
      const key = `${String(o.batch_id ?? "none")}::${snapshot.toLowerCase()}`;
      if (!unregisteredMap.has(key)) {
        unregisteredMap.set(key, {
          key,
          dateLabel: o.received_at ? new Date(String(o.received_at)).toLocaleString() : "—",
          offeringNumber: snapshot,
          ahadiAmount: 0,
          jengoAmount: 0,
          dayosisiAmount: 0,
          ahadiOfferingId: null,
          jengoOfferingId: null,
          dayosisiOfferingId: null,
          editableAhadi: false,
          editableJengo: false,
          editableDayosisi: false,
          rowPosted: Boolean(o.budget_posted),
        });
      }
      const row = unregisteredMap.get(key)!;
      row.rowPosted = row.rowPosted && Boolean(o.budget_posted);
      if (otName.includes("ahadi")) {
        row.ahadiAmount += amount;
        row.ahadiOfferingId ??= o.id;
        row.editableAhadi = row.editableAhadi || editable;
      } else if (otName.includes("jengo")) {
        row.jengoAmount += amount;
        row.jengoOfferingId ??= o.id;
        row.editableJengo = row.editableJengo || editable;
      } else if (otName.includes("maendeleo") || otName.includes("dayosisi")) {
        row.dayosisiAmount += amount;
        row.dayosisiOfferingId ??= o.id;
        row.editableDayosisi = row.editableDayosisi || editable;
      }
      continue;
    }
    const mem = o.members as {
      user_id?: string;
      offering_number?: string;
    } | null;
    const key = `${String(o.batch_id ?? "none")}::${String(o.member_id)}`;

    if (!registeredMap.has(key)) {
      registeredMap.set(key, {
        key,
        dateLabel: o.received_at ? new Date(String(o.received_at)).toLocaleString() : "—",
        offeringNumber: mem?.offering_number ?? "—",
        memberHref: mem?.user_id ? `/dashboard/members/${mem.user_id}/offerings` : null,
        ahadiAmount: 0,
        jengoAmount: 0,
        dayosisiAmount: 0,
        ahadiOfferingId: null,
        jengoOfferingId: null,
        dayosisiOfferingId: null,
        editableAhadi: false,
        editableJengo: false,
        editableDayosisi: false,
        rowPosted: Boolean(o.budget_posted),
      });
    }

    const row = registeredMap.get(key)!;
    row.rowPosted = row.rowPosted && Boolean(o.budget_posted);
    if (otName.includes("ahadi")) {
      row.ahadiAmount += amount;
      row.ahadiOfferingId ??= o.id;
      row.editableAhadi = row.editableAhadi || editable;
    } else if (otName.includes("jengo")) {
      row.jengoAmount += amount;
      row.jengoOfferingId ??= o.id;
      row.editableJengo = row.editableJengo || editable;
    } else if (otName.includes("maendeleo") || otName.includes("dayosisi")) {
      row.dayosisiAmount += amount;
      row.dayosisiOfferingId ??= o.id;
      row.editableDayosisi = row.editableDayosisi || editable;
    }
  }
  const registeredRowsUnfiltered = Array.from(registeredMap.values());
  const unregisteredRowsUnfiltered = Array.from(unregisteredMap.values());

  let registeredRows = registeredRowsUnfiltered;
  let unregisteredRows = unregisteredRowsUnfiltered;
  let otherOfferingRows = otherOfferingsRowsUnfiltered;

  if (regSearchNorm) {
    registeredRows = registeredRows.filter((r) => {
      const num = String(r.offeringNumber ?? "").toLowerCase();
      if (num.includes(regSearchNorm)) return true;
      return matchesOfferingAmountSearch(regSearchRaw, [
        r.ahadiAmount,
        r.jengoAmount,
        r.dayosisiAmount,
      ]);
    });
  }
  if (unregSearchNorm) {
    unregisteredRows = unregisteredRows.filter((r) => {
      if (String(r.offeringNumber ?? "").toLowerCase().includes(unregSearchNorm)) return true;
      return matchesOfferingAmountSearch(unregSearchRaw, [
        r.ahadiAmount,
        r.jengoAmount,
        r.dayosisiAmount,
      ]);
    });
  }
  if (collectiveSearchNorm) {
    otherOfferingRows = otherOfferingRows.filter((r) =>
      String(r.typeName ?? "").toLowerCase().includes(collectiveSearchNorm),
    );
  }

  const registeredTotalPages = Math.max(1, Math.ceil(registeredRows.length / offeringsTablePageSize));
  const safeRegPage = Math.min(regPage, registeredTotalPages);
  const regFrom = (safeRegPage - 1) * offeringsTablePageSize;
  const registeredRowsPage = registeredRows.slice(regFrom, regFrom + offeringsTablePageSize);

  const unregisteredTotalPages = Math.max(1, Math.ceil(unregisteredRows.length / offeringsTablePageSize));
  const safeUnregPage = Math.min(unregPage, unregisteredTotalPages);
  const unregFrom = (safeUnregPage - 1) * offeringsTablePageSize;
  const unregisteredRowsPage = unregisteredRows.slice(unregFrom, unregFrom + offeringsTablePageSize);

  const collectiveTotalPages = Math.max(
    1,
    Math.ceil(otherOfferingRows.length / offeringsTablePageSize),
  );
  const safeCollectivePage = Math.min(collectivePage, collectiveTotalPages);
  const collectiveFrom = (safeCollectivePage - 1) * offeringsTablePageSize;
  const otherOfferingRowsPage = otherOfferingRows.slice(
    collectiveFrom,
    collectiveFrom + offeringsTablePageSize,
  );

  const registeredTotals = registeredRows.reduce(
    (acc, r) => {
      acc.ahadi += r.ahadiAmount;
      acc.jengo += r.jengoAmount;
      acc.dayosisi += r.dayosisiAmount;
      return acc;
    },
    { ahadi: 0, jengo: 0, dayosisi: 0 },
  );

  const unregisteredTotals = unregisteredRows.reduce(
    (acc, r) => {
      acc.ahadi += r.ahadiAmount;
      acc.jengo += r.jengoAmount;
      acc.dayosisi += r.dayosisiAmount;
      return acc;
    },
    { ahadi: 0, jengo: 0, dayosisi: 0 },
  );

  const otherOfferingTotal = otherOfferingRows.reduce((sum, r) => sum + r.amount, 0);

  const batchPageHref = (page: number) => {
    const q = new URLSearchParams();
    if (batchSearch) q.set("batchSearch", batchSearch);
    if (batchStatus) q.set("batchStatus", batchStatus);
    if (selectedRegisteredBatchId) q.set("registeredBatchId", selectedRegisteredBatchId);
    q.set("batchPage", String(page));
    q.set("regPage", String(safeRegPage));
    q.set("unregPage", String(safeUnregPage));
    q.set("collectivePage", String(safeCollectivePage));
    if (regSearchRaw) q.set("regSearch", regSearchRaw);
    if (unregSearchRaw) q.set("unregSearch", unregSearchRaw);
    if (collectiveSearchRaw) q.set("collectiveSearch", collectiveSearchRaw);
    return withOfferingsSection(`/dashboard/offerings?${q.toString()}`, OFFERINGS_SECTION_IDS.batches);
  };
  const registeredBatchHref = (batchId: string) => {
    const q = new URLSearchParams();
    if (batchSearch) q.set("batchSearch", batchSearch);
    if (batchStatus) q.set("batchStatus", batchStatus);
    q.set("batchPage", String(safeBatchPage));
    q.set("registeredBatchId", batchId);
    q.set("regPage", "1");
    q.set("unregPage", "1");
    q.set("collectivePage", "1");
    if (regSearchRaw) q.set("regSearch", regSearchRaw);
    if (unregSearchRaw) q.set("unregSearch", unregSearchRaw);
    if (collectiveSearchRaw) q.set("collectiveSearch", collectiveSearchRaw);
    return withOfferingsSection(`/dashboard/offerings?${q.toString()}`, OFFERINGS_SECTION_IDS.registered);
  };

  const offeringsTableQuery = (
    patch: {
      regPage?: number;
      unregPage?: number;
      collectivePage?: number;
    },
    section: OfferingsSectionId = OFFERINGS_SECTION_IDS.registered,
  ) => {
    const q = new URLSearchParams();
    if (batchSearch) q.set("batchSearch", batchSearch);
    if (batchStatus) q.set("batchStatus", batchStatus);
    q.set("batchPage", String(safeBatchPage));
    if (selectedRegisteredBatchId) q.set("registeredBatchId", selectedRegisteredBatchId);
    q.set("regPage", String(patch.regPage ?? safeRegPage));
    q.set("unregPage", String(patch.unregPage ?? safeUnregPage));
    q.set("collectivePage", String(patch.collectivePage ?? safeCollectivePage));
    if (regSearchRaw) q.set("regSearch", regSearchRaw);
    if (unregSearchRaw) q.set("unregSearch", unregSearchRaw);
    if (collectiveSearchRaw) q.set("collectiveSearch", collectiveSearchRaw);
    return withOfferingsSection(`/dashboard/offerings?${q.toString()}`, section);
  };

  const offeringsMemberSearchHref = (
    next: {
      regSearch?: string;
      unregSearch?: string;
      collectiveSearch?: string;
    },
    section: OfferingsSectionId,
  ) => {
    const q = new URLSearchParams();
    if (batchSearch) q.set("batchSearch", batchSearch);
    if (batchStatus) q.set("batchStatus", batchStatus);
    q.set("batchPage", String(safeBatchPage));
    if (selectedRegisteredBatchId) q.set("registeredBatchId", selectedRegisteredBatchId);
    q.set("regPage", "1");
    q.set("unregPage", "1");
    q.set("collectivePage", "1");
    const rs = next.regSearch !== undefined ? next.regSearch : regSearchRaw;
    const us = next.unregSearch !== undefined ? next.unregSearch : unregSearchRaw;
    const cs = next.collectiveSearch !== undefined ? next.collectiveSearch : collectiveSearchRaw;
    if (rs.trim()) q.set("regSearch", rs.trim());
    if (us.trim()) q.set("unregSearch", us.trim());
    if (cs.trim()) q.set("collectiveSearch", cs.trim());
    return withOfferingsSection(`/dashboard/offerings?${q.toString()}`, section);
  };

  const batchDupIndexById = new Map<string, number>();
  const seenPerWeekSlot = new Map<string, number>();
  for (const b of batches ?? []) {
    const slot = Number((b as { batch_slot?: number }).batch_slot ?? 1);
    const weekKey = `${String(b.week_start_date)}::${String(b.week_end_date)}::${slot}`;
    const idx = (seenPerWeekSlot.get(weekKey) ?? 0) + 1;
    seenPerWeekSlot.set(weekKey, idx);
    batchDupIndexById.set(String(b.id), idx);
  }

  const batchBadgeLabel = (b: NonNullable<typeof batches>[number]) => {
    const n = Number((b as { batch_slot?: number }).batch_slot ?? 1);
    const dup = batchDupIndexById.get(String(b.id)) ?? 1;
    const kind = offeringBatchSlotLabel(n);
    const base = dup > 1 ? `Batch ${n} #${dup}` : `Batch ${n}`;
    return `${base} (${kind})`;
  };

  // Role/day-based visibility for entry forms (use church TZ — server is often UTC)
  const today = new Date();
  const churchTodayIso = getChurchLocalDateISO(today);
  const isSunday = isChurchLocalSunday(today);
  const isChurchElderOnly =
    hasRole(roles, "church_elder") &&
    !hasRole(roles, "admin") &&
    !hasRole(roles, "treasurer") &&
    !hasRole(roles, "committee_head");
  /** Elders use explicit Sunday batches 1–2; server blocks each batch separately when with treasurer. */
  let elderCanRecordThisWeek = true;
  if (isChurchElderOnly) {
    elderCanRecordThisWeek = isSunday;
  }

  const showWeeklyGrid = canRecord && (!isChurchElderOnly || elderCanRecordThisWeek);
  const elderCanUseAllOfferingInputsToday = isChurchElderOnly && isSunday && elderCanRecordThisWeek;
  const canUseAllOfferingInputs = canRecordMidWeek || elderCanUseAllOfferingInputsToday;
  if (isChurchElderOnly && !isSunday) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <OfferingsSectionScroll />
      </Suspense>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Offerings</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/dashboard/my-offerings">My offerings</ButtonLink>
          <ButtonLink href="/dashboard/offerings/reports">Offering reports</ButtonLink>
        </div>
      </div>

      {showWeeklyGrid ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sadaka za Wiki</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyOfferingGrid defaultWeekOf={churchTodayIso} />
          </CardContent>
        </Card>
      ) : null}

      {canUseAllOfferingInputs ? (
        <Card>
          <CardHeader>
            <SectionTitleWithInfo title="Sadaka Nyinginezo (Other Offerings)">
              Pick the batch (1, 2, or 3) that matches the service you are recording. Batch 3 unlocks after batch 2 is
              approved if your church uses two Sunday services; otherwise it unlocks after batch 1 is approved.
            </SectionTitleWithInfo>
          </CardHeader>
          <CardContent>
            <WeeklyCollectiveOfferingForm
              offeringTypes={collectiveOfferingTypes}
              defaultWeekOf={churchTodayIso}
              defaultBatchSlot={isSunday ? OFFERING_BATCH_SLOT_FIRST_SERVICE : OFFERING_BATCH_SLOT_MIDWEEK}
            />
          </CardContent>
        </Card>
      ) : null}

      {canUseAllOfferingInputs ? (
        <Card>
          <CardHeader>
            <SectionTitleWithInfo title="Ahadi nyinginezo (Other Pledges)">
              Choose the same batch as the Sunday service or mid-week period you are recording for. You can record
              both registered members and unregistered congregants.
            </SectionTitleWithInfo>
          </CardHeader>
          <CardContent>
            <OtherPledgesForm
              defaultBatchSlot={isSunday ? OFFERING_BATCH_SLOT_FIRST_SERVICE : OFFERING_BATCH_SLOT_MIDWEEK}
              offeringTypes={collectiveOfferingTypes}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card id={OFFERINGS_SECTION_IDS.registered}>
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">
            Sadaka za Wiki - Waliojisajili (Registered Offerings)
          </CardTitle>
          {registeredRows.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Page {safeRegPage} of {registeredTotalPages} · rows {regFrom + 1}–
              {Math.min(regFrom + offeringsTablePageSize, registeredRows.length)} of {registeredRows.length}
              {regSearchRaw ? ` (filtered)` : ""}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {registeredRowsUnfiltered.length > 0 ? (
            <form
              method="GET"
              action={`/dashboard/offerings#${OFFERINGS_SECTION_IDS.registered}`}
              className="flex flex-wrap items-end gap-2 border-b px-4 py-3"
            >
              <input type="hidden" name="batchPage" value={String(safeBatchPage)} />
              {selectedRegisteredBatchId ? (
                <input type="hidden" name="registeredBatchId" value={selectedRegisteredBatchId} />
              ) : null}
              <input type="hidden" name="regPage" value="1" />
              <input type="hidden" name="unregPage" value={String(safeUnregPage)} />
              <input type="hidden" name="collectivePage" value={String(safeCollectivePage)} />
              {batchSearch ? <input type="hidden" name="batchSearch" value={batchSearch} /> : null}
              {batchStatus ? <input type="hidden" name="batchStatus" value={batchStatus} /> : null}
              {unregSearchRaw ? <input type="hidden" name="unregSearch" value={unregSearchRaw} /> : null}
              {collectiveSearchRaw ? (
                <input type="hidden" name="collectiveSearch" value={collectiveSearchRaw} />
              ) : null}
              <div className="grid gap-1">
                <label htmlFor="regSearch" className="text-xs text-muted-foreground">
                  Search by offering # or amount
                </label>
                <input
                  id="regSearch"
                  name="regSearch"
                  defaultValue={regSearchRaw}
                  placeholder="e.g. 42 or 5000"
                  className="flex h-9 w-[min(100%,280px)] rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Search
              </button>
              {regSearchRaw ? (
                <ButtonLink
                  href={offeringsMemberSearchHref({ regSearch: "" }, OFFERINGS_SECTION_IDS.registered)}
                  variant="outline"
                >
                  Clear
                </ButtonLink>
              ) : null}
            </form>
          ) : null}
          <div className="max-h-[min(22rem,55vh)] overflow-y-auto border-b">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Offering #</TableHead>
                  <TableHead className="text-right">Ahadi (TZS)</TableHead>
                  <TableHead className="text-right">Jengo (TZS)</TableHead>
                  <TableHead className="text-right">Dayosisi (TZS)</TableHead>
                  <TableHead>Posted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registeredRowsUnfiltered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No offerings recorded.
                    </TableCell>
                  </TableRow>
                ) : registeredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No rows match this search.
                    </TableCell>
                  </TableRow>
                ) : (
                  registeredRowsPage.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>{row.dateLabel}</TableCell>
                      <TableCell>
                        {row.memberHref ? (
                          <Link href={row.memberHref} className="font-medium text-primary hover:underline">
                            {row.offeringNumber}
                          </Link>
                        ) : (
                          <span className="font-medium">{row.offeringNumber}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <OfferingAmountEditField
                          offeringId={row.ahadiOfferingId}
                          amount={row.ahadiAmount}
                          editable={row.editableAhadi}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <OfferingAmountEditField
                          offeringId={row.jengoOfferingId}
                          amount={row.jengoAmount}
                          editable={row.editableJengo}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <OfferingAmountEditField
                          offeringId={row.dayosisiOfferingId}
                          amount={row.dayosisiAmount}
                          editable={row.editableDayosisi}
                        />
                      </TableCell>
                      <TableCell>{row.rowPosted ? "Yes" : "No"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {registeredRows.length > 0 ? (
            <div className="flex flex-col gap-2 border-b px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {regSearchRaw ? "Subtotal (filtered rows)" : "Batch total (all rows)"}
                </span>{" "}
                — Ahadi {formatAmountTZS(registeredTotals.ahadi)}, Jengo{" "}
                {formatAmountTZS(registeredTotals.jengo)}, Dayosisi {formatAmountTZS(registeredTotals.dayosisi)}
              </div>
              <div className="flex items-center gap-3">
                {safeRegPage > 1 ? (
                  <ButtonLink
                    href={offeringsTableQuery({ regPage: safeRegPage - 1 }, OFFERINGS_SECTION_IDS.registered)}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </ButtonLink>
                ) : (
                  <span className="opacity-50">Previous</span>
                )}
                {safeRegPage < registeredTotalPages ? (
                  <ButtonLink
                    href={offeringsTableQuery({ regPage: safeRegPage + 1 }, OFFERINGS_SECTION_IDS.registered)}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </ButtonLink>
                ) : (
                  <span className="opacity-50">Next</span>
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {unregisteredRowsUnfiltered.length > 0 ? (
        <Card id={OFFERINGS_SECTION_IDS.unregistered}>
          <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">
              Sadaka za Wiki - Wasiojisajili (Unregistered Offerings)
            </CardTitle>
            {unregisteredRows.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Page {safeUnregPage} of {unregisteredTotalPages} · rows {unregFrom + 1}–
                {Math.min(unregFrom + offeringsTablePageSize, unregisteredRows.length)} of {unregisteredRows.length}
                {unregSearchRaw ? ` (filtered)` : ""}
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            <form
              method="GET"
              action={`/dashboard/offerings#${OFFERINGS_SECTION_IDS.unregistered}`}
              className="flex flex-wrap items-end gap-2 border-b px-4 py-3"
            >
              <input type="hidden" name="batchPage" value={String(safeBatchPage)} />
              {selectedRegisteredBatchId ? (
                <input type="hidden" name="registeredBatchId" value={selectedRegisteredBatchId} />
              ) : null}
              <input type="hidden" name="regPage" value={String(safeRegPage)} />
              <input type="hidden" name="unregPage" value="1" />
              <input type="hidden" name="collectivePage" value={String(safeCollectivePage)} />
              {batchSearch ? <input type="hidden" name="batchSearch" value={batchSearch} /> : null}
              {batchStatus ? <input type="hidden" name="batchStatus" value={batchStatus} /> : null}
              {regSearchRaw ? <input type="hidden" name="regSearch" value={regSearchRaw} /> : null}
              {collectiveSearchRaw ? (
                <input type="hidden" name="collectiveSearch" value={collectiveSearchRaw} />
              ) : null}
              <div className="grid gap-1">
                <label htmlFor="unregSearch" className="text-xs text-muted-foreground">
                  Search by offering # or amount
                </label>
                <input
                  id="unregSearch"
                  name="unregSearch"
                  defaultValue={unregSearchRaw}
                  placeholder="e.g. 105 or 5000"
                  className="flex h-9 w-[min(100%,220px)] rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Search
              </button>
              {unregSearchRaw ? (
                <ButtonLink
                  href={offeringsMemberSearchHref({ unregSearch: "" }, OFFERINGS_SECTION_IDS.unregistered)}
                  variant="outline"
                >
                  Clear
                </ButtonLink>
              ) : null}
            </form>
            <div className="max-h-[min(22rem,55vh)] overflow-y-auto border-b">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Offering #</TableHead>
                    <TableHead className="text-right">Ahadi (TZS)</TableHead>
                    <TableHead className="text-right">Jengo (TZS)</TableHead>
                    <TableHead className="text-right">Dayosisi (TZS)</TableHead>
                    <TableHead>Posted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unregisteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No rows match this search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    unregisteredRowsPage.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell>{row.dateLabel}</TableCell>
                        <TableCell className="font-medium">{row.offeringNumber}</TableCell>
                        <TableCell className="text-right">
                          <OfferingAmountEditField
                            offeringId={row.ahadiOfferingId}
                            amount={row.ahadiAmount}
                            editable={row.editableAhadi}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <OfferingAmountEditField
                            offeringId={row.jengoOfferingId}
                            amount={row.jengoAmount}
                            editable={row.editableJengo}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <OfferingAmountEditField
                            offeringId={row.dayosisiOfferingId}
                            amount={row.dayosisiAmount}
                            editable={row.editableDayosisi}
                          />
                        </TableCell>
                        <TableCell>{row.rowPosted ? "Yes" : "No"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {unregisteredRows.length > 0 ? (
              <div className="flex flex-col gap-2 border-b px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {unregSearchRaw ? "Subtotal (filtered unregistered)" : "Batch total (unregistered)"}
                  </span>{" "}
                  — Ahadi {formatAmountTZS(unregisteredTotals.ahadi)}, Jengo{" "}
                  {formatAmountTZS(unregisteredTotals.jengo)}, Dayosisi {formatAmountTZS(unregisteredTotals.dayosisi)}
                </div>
                <div className="flex items-center justify-end gap-3">
                  {safeUnregPage > 1 ? (
                    <ButtonLink
                      href={offeringsTableQuery({ unregPage: safeUnregPage - 1 }, OFFERINGS_SECTION_IDS.unregistered)}
                      variant="outline"
                      size="sm"
                    >
                      Previous
                    </ButtonLink>
                  ) : (
                    <span className="opacity-50">Previous</span>
                  )}
                  {safeUnregPage < unregisteredTotalPages ? (
                    <ButtonLink
                      href={offeringsTableQuery({ unregPage: safeUnregPage + 1 }, OFFERINGS_SECTION_IDS.unregistered)}
                      variant="outline"
                      size="sm"
                    >
                      Next
                    </ButtonLink>
                  ) : (
                    <span className="opacity-50">Next</span>
                  )}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card id={OFFERINGS_SECTION_IDS.collective}>
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Sadaka nyinginezo (Other Offerings) preview</CardTitle>
          {otherOfferingRows.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Page {safeCollectivePage} of {collectiveTotalPages} · rows {collectiveFrom + 1}–
              {Math.min(collectiveFrom + offeringsTablePageSize, otherOfferingRows.length)} of{" "}
              {otherOfferingRows.length}
              {collectiveSearchRaw ? " (filtered)" : ""}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {otherOfferingsRowsUnfiltered.length > 0 ? (
            <form
              method="GET"
              action={`/dashboard/offerings#${OFFERINGS_SECTION_IDS.collective}`}
              className="flex flex-wrap items-end gap-2 border-b px-4 py-3"
            >
              <input type="hidden" name="batchPage" value={String(safeBatchPage)} />
              {selectedRegisteredBatchId ? (
                <input type="hidden" name="registeredBatchId" value={selectedRegisteredBatchId} />
              ) : null}
              <input type="hidden" name="collectivePage" value="1" />
              <input type="hidden" name="regPage" value={String(safeRegPage)} />
              <input type="hidden" name="unregPage" value={String(safeUnregPage)} />
              {batchSearch ? <input type="hidden" name="batchSearch" value={batchSearch} /> : null}
              {batchStatus ? <input type="hidden" name="batchStatus" value={batchStatus} /> : null}
              {regSearchRaw ? <input type="hidden" name="regSearch" value={regSearchRaw} /> : null}
              {unregSearchRaw ? <input type="hidden" name="unregSearch" value={unregSearchRaw} /> : null}
              <div className="grid gap-1">
                <label htmlFor="collectiveSearch" className="text-xs text-muted-foreground">
                  Search by offering type
                </label>
                <input
                  id="collectiveSearch"
                  name="collectiveSearch"
                  defaultValue={collectiveSearchRaw}
                  placeholder="e.g. Ujenzi"
                  className="flex h-9 w-[min(100%,280px)] rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Search
              </button>
              {collectiveSearchRaw ? (
                <ButtonLink
                  href={offeringsMemberSearchHref({ collectiveSearch: "" }, OFFERINGS_SECTION_IDS.collective)}
                  variant="outline"
                >
                  Clear
                </ButtonLink>
              ) : null}
            </form>
          ) : null}
          <div className="max-h-[min(22rem,55vh)] overflow-y-auto border-b">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Offering type</TableHead>
                  <TableHead className="text-right">Amount (TZS)</TableHead>
                  <TableHead>Posted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {otherOfferingsRowsUnfiltered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No other offerings in this batch. Record them under Sadaka Nyinginezo (Other Offerings), or
                      select another batch in Recent Batches.
                    </TableCell>
                  </TableRow>
                ) : otherOfferingRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No rows match this search.
                    </TableCell>
                  </TableRow>
                ) : (
                  otherOfferingRowsPage.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>{row.dateLabel}</TableCell>
                      <TableCell className="font-medium">{row.typeName}</TableCell>
                      <TableCell className="text-right">
                        <OfferingAmountEditField
                          offeringId={row.offeringId}
                          amount={row.amount}
                          editable={row.editable}
                        />
                      </TableCell>
                      <TableCell>{row.rowPosted ? "Yes" : "No"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {otherOfferingRows.length > 0 ? (
            <div className="flex flex-col gap-2 border-b px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {collectiveSearchRaw ? "Subtotal (filtered rows)" : "Batch total (other offerings)"}
                </span>{" "}
                — {formatAmountTZS(otherOfferingTotal)}
              </div>
              <div className="flex items-center gap-3">
                {safeCollectivePage > 1 ? (
                  <ButtonLink
                    href={offeringsTableQuery({ collectivePage: safeCollectivePage - 1 }, OFFERINGS_SECTION_IDS.collective)}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </ButtonLink>
                ) : (
                  <span className="opacity-50">Previous</span>
                )}
                {safeCollectivePage < collectiveTotalPages ? (
                  <ButtonLink
                    href={offeringsTableQuery({ collectivePage: safeCollectivePage + 1 }, OFFERINGS_SECTION_IDS.collective)}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </ButtonLink>
                ) : (
                  <span className="opacity-50">Next</span>
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card id={OFFERINGS_SECTION_IDS.batches}>
        <CardHeader>
          <CardTitle className="text-lg">Recent Batches</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            method="GET"
            action={`/dashboard/offerings#${OFFERINGS_SECTION_IDS.batches}`}
            className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3"
          >
            {selectedRegisteredBatchId ? (
              <input type="hidden" name="registeredBatchId" value={selectedRegisteredBatchId} />
            ) : null}
            <input type="hidden" name="regPage" value="1" />
            <input type="hidden" name="unregPage" value="1" />
            <input type="hidden" name="collectivePage" value="1" />
            {regSearchRaw ? <input type="hidden" name="regSearch" value={regSearchRaw} /> : null}
            {unregSearchRaw ? <input type="hidden" name="unregSearch" value={unregSearchRaw} /> : null}
            {collectiveSearchRaw ? (
              <input type="hidden" name="collectiveSearch" value={collectiveSearchRaw} />
            ) : null}
            <div className="grid gap-1">
              <label htmlFor="batchSearch" className="text-xs text-muted-foreground">
                Search by date/status
              </label>
              <input
                id="batchSearch"
                name="batchSearch"
                defaultValue={batchSearch}
                placeholder="e.g. 2026-04 or authorized"
                className="flex h-9 w-[220px] rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="batchStatus" className="text-xs text-muted-foreground">
                Status
              </label>
              <select
                id="batchStatus"
                name="batchStatus"
                defaultValue={batchStatus || "all"}
                className="flex h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="all">All</option>
                <option value="pending_authorization">Pending authorization</option>
                <option value="authorized">Authorized</option>
                <option value="rejected">Rejected</option>
                <option value="approved">Approved</option>
              </select>
            </div>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Search
            </button>
            <ButtonLink href={withOfferingsSection("/dashboard/offerings", OFFERINGS_SECTION_IDS.batches)}>
              Clear
            </ButtonLink>
          </form>

          <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recorded</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(batches ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No batches yet.
                  </TableCell>
                </TableRow>
              ) : (
                (batches ?? []).map((b) => {
                  return (
                    <TableRow
                      key={b.id}
                      className="cursor-pointer hover:bg-muted/40"
                    >
                      <TableCell>
                        <Link
                          href={registeredBatchHref(b.id)}
                          className="inline-flex w-full items-center gap-2 font-medium text-primary underline-offset-4 hover:underline"
                        >
                          <span>{String(b.week_start_date)} → {String(b.week_end_date)}</span>
                          <Badge variant="secondary">{batchBadgeLabel(b)}</Badge>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={registeredBatchHref(b.id)} className="block w-full">
                          {Number(b.affected_rows ?? 0)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={registeredBatchHref(b.id)} className="block w-full">
                          {String(b.status)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={registeredBatchHref(b.id)} className="block w-full">
                          {b.created_at ? new Date(String(b.created_at)).toLocaleString() : "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {String(b.id) === selectedRegisteredBatchId ? (
                            <span className="text-xs text-muted-foreground">Loaded</span>
                          ) : null}
                          <ButtonLink href={`/dashboard/offerings/batches/${b.id}`} variant="outline" size="sm">
                            View
                          </ButtonLink>
                          {(b.status === "pending_authorization" || b.status === "rejected") &&
                          canAuthorize ? (
                            <AuthorizeBatchButton batchId={b.id} />
                          ) : null}
                          {b.status === "authorized" && canApprove ? (
                            <>
                              <RejectBatchButton batchId={b.id} />
                              <ApproveBatchButton batchId={b.id} />
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {safeBatchPage} of {totalBatchPages}
            </span>
            <div className="flex items-center gap-3">
              {safeBatchPage > 1 ? (
                <ButtonLink href={batchPageHref(safeBatchPage - 1)} variant="outline" size="sm">
                  Previous
                </ButtonLink>
              ) : (
                <span className="opacity-50">Previous</span>
              )}
              {safeBatchPage < totalBatchPages ? (
                <ButtonLink href={batchPageHref(safeBatchPage + 1)} variant="outline" size="sm">
                  Next
                </ButtonLink>
              ) : (
                <span className="opacity-50">Next</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {hasRole(roles, "admin") ? <OfferingTypeForm /> : null}
    </div>
  );
}
