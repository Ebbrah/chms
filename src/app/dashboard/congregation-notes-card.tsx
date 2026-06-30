"use client";

import { useRef, useState } from "react";
import { createCongregationNote, deleteCongregationNote } from "@/lib/actions/congregation-notes";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/action-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type NoteRow = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
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
  const posterInputRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgIsError, setMsgIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [posterLoading, setPosterLoading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isPosterMode, setIsPosterMode] = useState(false);
  const [scope, setScope] = useState(canPostGlobal ? "global" : "jumuiya");

  function resetForm() {
    setTitle("");
    setBody("");
    setImageDataUrl("");
    setIsPosterMode(false);
    setFileInputKey((k) => k + 1);
    if (posterInputRef.current) posterInputRef.current.value = "";
  }

  function onPosterPicked(file: File | null) {
    if (!file) {
      setImageDataUrl("");
      return;
    }
    setPosterLoading(true);
    setMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(typeof reader.result === "string" ? reader.result : "");
      setPosterLoading(false);
    };
    reader.onerror = () => {
      setPosterLoading(false);
      setMsgIsError(true);
      setMsg("Could not read the selected image. Try a smaller file.");
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || posterLoading) return;

    setMsg(null);
    setMsgIsError(false);

    if (isPosterMode && !imageDataUrl.startsWith("data:image/")) {
      setMsgIsError(true);
      setMsg("Chagua picha ya poster / flier kwanza.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("title", title);
      fd.set("body", body);
      fd.set("scope", scope);
      if (imageDataUrl.startsWith("data:image/")) {
        fd.set("image_data_url", imageDataUrl);
      }
      const res = await createCongregationNote(fd);
      if ("error" in res && res.error) {
        setMsgIsError(true);
        setMsg(res.error);
        return;
      }
      resetForm();
      setMsg("Taarifa imehifadhiwa.");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  function canDeleteThisNote(n: NoteRow): boolean {
    if (canModerateNotes) return true;
    return Boolean(currentUserId && n.author_user_id === currentUserId);
  }

  async function onDelete(noteId: string) {
    if (!confirm("Futa taarifa hii?")) return;
    setMsg(null);
    setMsgIsError(false);
    setDeletingId(noteId);
    try {
      const res = await deleteCongregationNote(noteId);
      if ("error" in res && res.error) {
        setMsgIsError(true);
        setMsg(res.error);
        return;
      }
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  const canSubmitPoster = !isPosterMode || (imageDataUrl.startsWith("data:image/") && !posterLoading);

  return (
    <Card>
      <CardHeader>
        <CardTitle>News / Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canPostGlobal || canPostJumuiya ? (
          <form onSubmit={(e) => void onSubmit(e)} className="grid gap-3 rounded-md border p-3">
            {msg ? (
              <p className={`text-xs ${msgIsError ? "text-destructive" : "text-muted-foreground"}`}>{msg}</p>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="note-title">Kichwa</Label>
              <Input
                id="note-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Button
                type="button"
                variant={isPosterMode ? "default" : "outline"}
                size="sm"
                disabled={submitting}
                onClick={() => {
                  setIsPosterMode(true);
                  setImageDataUrl("");
                  setFileInputKey((k) => k + 1);
                }}
              >
                Poster / Flier
              </Button>
              <Button
                type="button"
                variant={!isPosterMode ? "default" : "outline"}
                size="sm"
                disabled={submitting}
                onClick={() => {
                  setIsPosterMode(false);
                  setImageDataUrl("");
                  setPosterLoading(false);
                }}
              >
                Normal text
              </Button>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note-body">{isPosterMode ? "Caption (optional)" : "Ujumbe"}</Label>
              <Textarea
                id="note-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required={!isPosterMode}
                disabled={submitting}
              />
            </div>
            {isPosterMode ? (
              <div className="grid gap-2">
                <Label htmlFor="poster-upload">Poster / Flier image</Label>
                <Input
                  key={fileInputKey}
                  ref={posterInputRef}
                  id="poster-upload"
                  type="file"
                  accept="image/*"
                  disabled={submitting || posterLoading}
                  onChange={(e) => onPosterPicked(e.target.files?.[0] ?? null)}
                />
                {posterLoading ? (
                  <p className="text-xs text-muted-foreground">Inapakia picha…</p>
                ) : null}
                {imageDataUrl ? (
                  <Image
                    src={imageDataUrl}
                    alt="Poster preview"
                    width={640}
                    height={360}
                    className="max-h-64 w-full rounded-md border object-contain"
                    unoptimized
                  />
                ) : null}
              </div>
            ) : null}
            {canPostGlobal && canPostJumuiya ? (
              <div className="grid gap-2">
                <Label>Aina ya taarifa</Label>
                <Select value={scope} onValueChange={setScope} disabled={submitting}>
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
              <SubmitButton
                loading={submitting}
                loadingText="Inatumwa…"
                disabled={!canSubmitPoster}
              >
                Tuma taarifa
              </SubmitButton>
            </div>
          </form>
        ) : null}

        <div className="space-y-3">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Hakuna taarifa mpya.</p>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="rounded-md border p-3 shadow-sm">
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
                      {deletingId === n.id ? "Inafuta…" : "Delete"}
                    </Button>
                  ) : null}
                </div>
                {n.image_url ? (
                  <div className="space-y-2">
                    <Image
                      src={n.image_url}
                      alt={n.title}
                      width={1200}
                      height={800}
                      className="max-h-[28rem] w-full rounded-md border object-contain"
                    />
                    {n.body ? <p className="text-sm whitespace-pre-wrap">{n.body}</p> : null}
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                )}
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
