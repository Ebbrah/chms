"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toDisplayCaps } from "@/lib/format/name";
import { LoadSeedButton } from "./seed-load-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type MemberRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  phone: string | null;
  offering_number: string | null;
  status: string | null;
};

export type { ProfileRow, MemberRow };

export function MembersTable({
  profiles,
  membersByUser,
}: {
  profiles: ProfileRow[];
  membersByUser: Record<string, MemberRow | undefined>;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return profiles;
    return profiles.filter((p) => String(p.full_name ?? "").toLowerCase().includes(query));
  }, [profiles, q]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {filtered.length} of {profiles.length}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-[360px] sm:flex-row sm:items-center">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            aria-label="Search members by name"
          />
          {q.trim() ? (
            <Button variant="outline" onClick={() => setQ("")} type="button">
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email/User ID</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Offering no.</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No results.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => {
                const m = membersByUser[p.id];
                const detailHref = `/dashboard/members/${p.id}/details`;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={detailHref} className="block w-full underline-offset-4 hover:underline">
                        {toDisplayCaps(p.full_name)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Link href={detailHref} className="block w-full">
                        <div>{m?.email ?? p.email ?? "—"}</div>
                        <div className="font-mono text-muted-foreground">{p.id}</div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={detailHref} className="block w-full">
                        {m?.phone ?? p.phone ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={detailHref} className="block w-full">
                        {m?.offering_number ?? "Not assigned"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={detailHref} className="block w-full">
                        {m?.status ?? "pending_profile"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="link" asChild>
                        <Link href={detailHref}>View</Link>
                      </Button>
                      <Button variant="link" asChild>
                        <Link href={`/dashboard/members/${p.id}`}>Edit</Link>
                      </Button>
                      <LoadSeedButton userId={p.id} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

