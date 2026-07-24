"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { approvePendingMemberRegistration } from "@/lib/actions/members";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type PendingRegistrationRow = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string;
};

export function PendingRegistrationsTable({ rows }: { rows: PendingRegistrationRow[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onApprove(memberId: string) {
    if (!confirm("Approve this registration and assign the next offering number?")) return;
    setMsg(null);
    setBusyId(memberId);
    const res = await approvePendingMemberRegistration(memberId);
    setBusyId(null);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    setMsg(
      res.offeringNumber
        ? `Approved. Assigned offering number ${res.offeringNumber}.`
        : "Approved.",
    );
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No pending registration requests.</p>
    );
  }

  return (
    <div className="space-y-3">
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.fullName || "—"}</TableCell>
                <TableCell>{row.email || "—"}</TableCell>
                <TableCell>{row.phone || "—"}</TableCell>
                <TableCell>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/members/${row.userId}`}>Review</Link>
                    </Button>
                    <ActionButton
                      size="sm"
                      loading={busyId === row.id}
                      loadingText="Approving…"
                      onClick={() => void onApprove(row.id)}
                    >
                      Approve & assign number
                    </ActionButton>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
