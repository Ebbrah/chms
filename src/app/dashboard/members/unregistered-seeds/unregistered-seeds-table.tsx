"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatAmountTZS } from "@/lib/format/amount";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type UnregisteredSeedRow = {
  id: string;
  offering_number: string;
  full_name: string;
  gender: string | null;
  phone: string | null;
  pledge_ahadi: number | null;
  pledge_jengo: number | null;
  pledge_dayosisi: number | null;
};

function fmtPledge(v: number | null) {
  return v == null ? "—" : formatAmountTZS(v);
}

export function UnregisteredSeedsTable({
  unmatchedRows,
  allRows,
}: {
  unmatchedRows: UnregisteredSeedRow[];
  allRows: UnregisteredSeedRow[];
}) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const activeRows = showAll ? allRows : unmatchedRows;

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeRows;
    return activeRows.filter((row) => {
      const offering = String(row.offering_number ?? "").toLowerCase();
      const name = String(row.full_name ?? "").toLowerCase();
      const phone = String(row.phone ?? "").toLowerCase();
      return offering.includes(q) || name.includes(q) || phone.includes(q);
    });
  }, [activeRows, query]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            Show all uploaded rows
          </label>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-[460px] sm:flex-row sm:items-center sm:justify-end">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by offering no, name, phone..."
            aria-label="Search uploaded unregistered members"
          />
          {query.trim() ? (
            <Button variant="outline" onClick={() => setQuery("")} type="button">
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Offering no.</TableHead>
              <TableHead>Full name</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Ahadi</TableHead>
              <TableHead>Jengo</TableHead>
              <TableHead>Dayosisi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No matching uploaded members.
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((seed) => (
                <TableRow key={seed.id}>
                  <TableCell>{seed.offering_number}</TableCell>
                  <TableCell>{seed.full_name}</TableCell>
                  <TableCell>{seed.gender ?? "—"}</TableCell>
                  <TableCell>{seed.phone ?? "—"}</TableCell>
                  <TableCell>{fmtPledge(seed.pledge_ahadi)}</TableCell>
                  <TableCell>{fmtPledge(seed.pledge_jengo)}</TableCell>
                  <TableCell>{fmtPledge(seed.pledge_dayosisi)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
