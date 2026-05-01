"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toDisplayCaps } from "@/lib/format/name";

type Row = { id: string; full_name: string | null; phone: string | null; roles: string };

export function RolesUserTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const name = String(r.full_name ?? "").toLowerCase();
      const id = r.id.toLowerCase();
      const roles = r.roles.toLowerCase();
      const phone = String(r.phone ?? "").toLowerCase();
      return name.includes(s) || id.includes(s) || roles.includes(s) || phone.includes(s);
    });
  }, [rows, q]);

  return (
    <div className="space-y-3">
      <div className="grid gap-1 max-w-sm">
        <Label htmlFor="roles-table-search">Tafuta kwenye jedwali</Label>
        <Input
          id="roles-table-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Jina, simu, namba ya mtumiaji, au jukumu…"
        />
      </div>
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Roles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  Hakuna matokeo.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{toDisplayCaps(p.full_name ?? p.id.slice(0, 8))}</div>
                    <div className="text-xs text-muted-foreground font-mono">{p.id}</div>
                  </TableCell>
                  <TableCell>{p.roles || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
