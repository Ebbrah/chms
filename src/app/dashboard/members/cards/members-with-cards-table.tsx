"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatAmountTZS } from "@/lib/format/amount";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type MemberRow = {
  id: string;
  user_id: string | null;
  phone: string | null;
  status: string | null;
  offering_number: string | null;
  household_id: string | null;
  member_details: unknown;
};

export type { MemberRow };

function readDetail(details: Record<string, unknown> | null, key: string, fallback = "—") {
  if (!details) return fallback;
  const value = details[key];
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function readPledgeDetail(details: Record<string, unknown> | null, key: string) {
  const raw = readDetail(details, key, "");
  if (!raw || raw === "—") return "—";
  const n = Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return raw;
  return formatAmountTZS(n);
}

export function MembersWithCardsTable({
  membersWithCards,
  householdNameById,
}: {
  membersWithCards: MemberRow[];
  householdNameById: Record<string, string>;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return membersWithCards;
    return membersWithCards.filter((m) =>
      String(m.offering_number ?? "").toLowerCase().includes(query),
    );
  }, [membersWithCards, q]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              Showing {filtered.length} of {membersWithCards.length} member(s) with assigned offering numbers.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-[360px] sm:flex-row sm:items-center">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by offering number…"
              aria-label="Search by offering number"
            />
            {q.trim() ? (
              <Button variant="outline" onClick={() => setQ("")} type="button">
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Offering no.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead>Jumuiya</TableHead>
              <TableHead>Ahadi</TableHead>
              <TableHead>Jengo</TableHead>
              <TableHead>Maendeleo ya Dayosisi</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No results.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => {
                const details =
                  m.member_details && typeof m.member_details === "object"
                    ? (m.member_details as Record<string, unknown>)
                    : null;
                const householdName = m.household_id
                  ? (householdNameById[String(m.household_id)] ?? "")
                  : "";
                const detailHref = m.user_id ? `/dashboard/members/${m.user_id}/details` : null;

                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      {detailHref ? (
                        <Link
                          href={detailHref}
                          className="block w-full font-medium underline-offset-4 hover:underline"
                        >
                          {m.offering_number ?? "—"}
                        </Link>
                      ) : (
                        <span className="font-medium">{m.offering_number ?? "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {detailHref ? (
                        <Link href={detailHref} className="block w-full">
                          {readDetail(details, "full_name")}
                        </Link>
                      ) : (
                        readDetail(details, "full_name")
                      )}
                    </TableCell>
                    <TableCell>
                      {detailHref ? (
                        <Link href={detailHref} className="block w-full">
                          {m.phone ?? "—"}
                        </Link>
                      ) : (
                        m.phone ?? "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {detailHref ? (
                        <Link href={detailHref} className="block w-full">
                          {readDetail(details, "jumuiya_name", householdName || "—")}
                        </Link>
                      ) : (
                        readDetail(details, "jumuiya_name", householdName || "—")
                      )}
                    </TableCell>
                    <TableCell>
                      {detailHref ? (
                        <Link href={detailHref} className="block w-full">
                          {readPledgeDetail(details, "pledge_1")}
                        </Link>
                      ) : (
                        readPledgeDetail(details, "pledge_1")
                      )}
                    </TableCell>
                    <TableCell>
                      {detailHref ? (
                        <Link href={detailHref} className="block w-full">
                          {readPledgeDetail(details, "pledge_2")}
                        </Link>
                      ) : (
                        readPledgeDetail(details, "pledge_2")
                      )}
                    </TableCell>
                    <TableCell>
                      {detailHref ? (
                        <Link href={detailHref} className="block w-full">
                          {readPledgeDetail(details, "pledge_3")}
                        </Link>
                      ) : (
                        readPledgeDetail(details, "pledge_3")
                      )}
                    </TableCell>
                    <TableCell>
                      {detailHref ? (
                        <Link href={detailHref} className="block w-full">
                          {m.status ?? "—"}
                        </Link>
                      ) : (
                        m.status ?? "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

