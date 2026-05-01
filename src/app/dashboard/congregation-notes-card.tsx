"use client";

import { useState } from "react";
import { createCongregationNote, deleteCongregationNote } from "@/lib/actions/congregation-notes";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type NoteRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author_user_id: string;
  author_name: string;
  scope_label: string;
};

function formatUtcDateTime(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  const hh = String(dt.getUTCHours()).padStart(2, "0");
  const mm = String(dt.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm} UTC`;
}

export function CongregationNotesCard({
  notes,
  canPostGlobal,
  canPostJumuiya,
  currentUserId,
  canModerateNotes,
}: {
  notes: NoteRow[];
  canPostGlobal: boolean;
  canPostJumuiya: boolean;
  /** Logged-in user id (for “delete own note”). */
  currentUserId: string | null;
  /** Admin / pastoral staff: may delete any note (matches RLS). */
  canModerateNotes: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState(canPostGlobal ? "global" : "jumuiya");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("body", body);
    fd.set("scope", scope);
    const res = await createCongregationNote(fd);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    setTitle("");
    setBody("");
    setMsg("Taarifa imehifadhiwa.");
    router.refresh();
  }

  function canDeleteThisNote(n: NoteRow): boolean {
    if (canModerateNotes) return true;
    return Boolean(currentUserId && n.author_user_id === currentUserId);
  }

  async function onDelete(noteId: string) {
    if (!confirm("Futa taarifa hii?")) return;
    setMsg(null);
    setDeletingId(noteId);
    const res = await deleteCongregationNote(noteId);
    setDeletingId(null);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>News / Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canPostGlobal || canPostJumuiya ? (
          <form onSubmit={(e) => void onSubmit(e)} className="grid gap-3 rounded-md border p-3">
            {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
            <div className="grid gap-2">
              <Label htmlFor="note-title">Kichwa</Label>
              <Input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note-body">Ujumbe</Label>
              <Textarea id="note-body" value={body} onChange={(e) => setBody(e.target.value)} required />
            </div>
            {canPostGlobal && canPostJumuiya ? (
              <div className="grid gap-2">
                <Label>Aina ya taarifa</Label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Kwa waumini wote</SelectItem>
                    <SelectItem value="jumuiya">Kwa Jumuiya yangu tu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Audience:</span>
              <Badge variant="secondary">
                {scope === "global" ? "Waumini wote (Global)" : "Jumuiya yangu tu"}
              </Badge>
            </div>
            <div>
              <Button type="submit">Tuma taarifa</Button>
            </div>
          </form>
        ) : null}

        <div className="space-y-3">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Hakuna taarifa mpya.</p>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="rounded-md border p-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="font-medium">{n.title}</p>
                  {canDeleteThisNote(n) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 text-destructive hover:text-destructive"
                      disabled={deletingId === n.id}
                      onClick={() => void onDelete(n.id)}
                    >
                      {deletingId === n.id ? "…" : "Delete"}
                    </Button>
                  ) : null}
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {n.scope_label} | {n.author_name || "Unknown"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{formatUtcDateTime(n.created_at)}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
