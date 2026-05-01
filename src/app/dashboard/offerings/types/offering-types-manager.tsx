"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteOfferingType, updateOfferingType } from "@/lib/actions/offerings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function OfferingTypesManager({
  offeringTypes,
}: {
  offeringTypes: Array<{ id: string; name: string | null }>;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  async function onSave() {
    if (!editingId) return;
    setMsg(null);
    const fd = new FormData();
    fd.set("id", editingId);
    fd.set("name", editingName);
    const res = await updateOfferingType(fd);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    setMsg("Offering type updated.");
    setEditingId(null);
    setEditingName("");
    router.refresh();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this offering type? This cannot be undone.")) return;
    setMsg(null);
    const res = await deleteOfferingType(id);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    if (editingId === id) {
      setEditingId(null);
      setEditingName("");
    }
    setMsg("Offering type deleted.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      {offeringTypes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No offering types yet.</p>
      ) : (
        offeringTypes.map((t) => (
          <div
            key={t.id}
            className="group flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
          >
            {editingId === t.id ? (
              <>
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="max-w-sm"
                />
                <Button type="button" onClick={() => void onSave()}>
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setEditingName("");
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{t.name ?? "—"}</span>
                <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(t.id);
                      setEditingName(String(t.name ?? ""));
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void onDelete(t.id)}
                  >
                    Delete
                  </Button>
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
