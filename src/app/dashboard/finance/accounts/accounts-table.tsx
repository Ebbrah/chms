"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount, updateAccount } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";

export type AccountRow = {
  id: string;
  code: string | null;
  name: string | null;
  type: "asset" | "liability" | "equity" | "revenue" | "expense" | (string & {});
  is_active: boolean | null;
};

const TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;

export function AccountsTable({ accounts }: { accounts: AccountRow[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("expense");
  const [active, setActive] = useState(true);

  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  async function onSave() {
    if (!editingId) return;
    setMsg(null);
    const fd = new FormData();
    fd.set("id", editingId);
    fd.set("code", code);
    fd.set("name", name);
    fd.set("type", type);
    fd.set("is_active", active ? "true" : "false");
    const res = await updateAccount(fd);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    setEditingId(null);
    setCode("");
    setName("");
    setType("expense");
    setActive(true);
    router.refresh();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this account? This cannot be undone.")) return;
    setMsg(null);
    const res = await deleteAccount(id);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    if (editingId === id) {
      setEditingId(null);
      setCode("");
      setName("");
      setType("expense");
      setActive(true);
    }
    router.refresh();
  }

  return (
    <TableBody>
      {msg ? (
        <TableRow>
          <TableCell colSpan={5} className="text-sm text-muted-foreground">
            {msg}
          </TableCell>
        </TableRow>
      ) : null}
      {accounts.length === 0 ? (
        <TableRow>
          <TableCell colSpan={5} className="text-center text-muted-foreground">
            No accounts. Run seed SQL or add above.
          </TableCell>
        </TableRow>
      ) : (
        accounts.map((a) => {
          const isEditing = editingId === a.id;
          return (
            <TableRow key={a.id} className="group">
              <TableCell className="w-[140px] font-mono text-xs">
                {isEditing ? (
                  <Input value={code} onChange={(e) => setCode(e.target.value)} />
                ) : (
                  a.code
                )}
              </TableCell>
              <TableCell>
                {isEditing ? (
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                ) : (
                  a.name
                )}
              </TableCell>
              <TableCell className="w-[180px]">
                {isEditing ? (
                  <Select value={type} onValueChange={(v) => setType(v as (typeof TYPES)[number])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  String(a.type ?? "")
                )}
              </TableCell>
              <TableCell className="w-[90px]">
                {isEditing ? (
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                    />
                    Active
                  </label>
                ) : a.is_active ? (
                  "yes"
                ) : (
                  "no"
                )}
              </TableCell>
              <TableCell className="w-[240px] text-right">
                {isEditing ? (
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" onClick={() => void onSave()}>
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(null);
                        setCode("");
                        setName("");
                        setType("expense");
                        setActive(true);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const row = byId.get(a.id);
                        if (!row) return;
                        setEditingId(a.id);
                        setCode(String(row.code ?? ""));
                        setName(String(row.name ?? ""));
                        setType(
                          (TYPES.includes(row.type as (typeof TYPES)[number]) ? row.type : "expense") as (typeof TYPES)[number],
                        );
                        setActive(Boolean(row.is_active));
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => void onDelete(a.id)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })
      )}
    </TableBody>
  );
}

