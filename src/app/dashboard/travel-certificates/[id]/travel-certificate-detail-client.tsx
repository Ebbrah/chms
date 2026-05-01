"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  approveTravelCertificate,
  rejectTravelCertificate,
  upsertTravelCertificateByStaff,
} from "@/lib/actions/travel-certificates";

type HouseholdRow = { id: string; name: string | null };

export function TravelCertificateDetailClient({
  certificate,
  households,
  settings,
  householdName,
  canManage,
  canIssue,
  isOwner,
}: {
  certificate: Record<string, unknown>;
  households: HouseholdRow[];
  settings: Record<string, unknown> | null;
  householdName: string;
  canManage: boolean;
  canIssue: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [msgIsError, setMsgIsError] = useState(false);

  const status = String(certificate.status ?? "");
  const requestKind = String(certificate.request_kind ?? "manual");
  const lockRequestFields = requestKind !== "manual";
  const isIssued = status === "issued";
  const disableForm = !canManage || isIssued;
  const issuedDate = String(certificate.issued_date ?? certificate.issued_at ?? certificate.created_at ?? "");
  const certificateNo = String(certificate.certificate_number ?? "Pending");
  const displayDate = issuedDate ? new Date(issuedDate).toISOString().slice(0, 10) : "—";
  const certificateHousehold = householdName || String(certificate.address ?? "").trim() || "—";
  const boolText = (value: unknown) => (value ? "Ndiyo" : "Hapana");
  const previewSignature =
    String(certificate.pastor_signature_url ?? "").trim() ||
    String(settings?.pastor_signature_url ?? "").trim();
  const previewStamp =
    String(certificate.pastor_stamp_url ?? "").trim() ||
    String(settings?.pastor_stamp_url ?? "").trim();

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setMsgIsError(false);
    const fd = new FormData(e.currentTarget);
    const res = await upsertTravelCertificateByStaff(fd);
    if ("error" in res && res.error) {
      setMsgIsError(true);
      setMsg(res.error);
      return;
    }
    setMsg("Certificate saved.");
    router.refresh();
  }

  async function onIssue() {
    setMsg(null);
    setMsgIsError(false);
    const res = await approveTravelCertificate(String(certificate.id ?? ""));
    if ("error" in res && res.error) {
      setMsgIsError(true);
      setMsg(res.error);
      return;
    }
    setMsg("Certificate issued successfully.");
    router.refresh();
  }

  async function onReject() {
    const reason = window.prompt("Provide reject reason", String(certificate.reject_reason ?? ""));
    if (reason === null) return;
    setMsg(null);
    setMsgIsError(false);
    const res = await rejectTravelCertificate(String(certificate.id ?? ""), reason);
    if ("error" in res && res.error) {
      setMsgIsError(true);
      setMsg(res.error);
      return;
    }
    setMsg("Certificate request rejected.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Travel certificate view</h1>
          <p className="text-sm text-muted-foreground">
            Review, edit, or issue this certificate according to your role.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/travel-certificates">Back</Link>
        </Button>
      </div>

      {msg ? (
        <Alert variant={msgIsError ? "destructive" : "default"}>
          <AlertTitle>{msgIsError ? "Could not save" : "Done"}</AlertTitle>
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{isOwner && !canManage ? "Certificate preview" : "Certificate preview"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mx-auto max-w-4xl rounded-xl border-2 border-slate-300 bg-gradient-to-b from-white to-slate-50 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border bg-white">
                {String(settings?.logo_url ?? "").trim() ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={String(settings?.logo_url ?? "")}
                    alt="Church logo"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-muted-foreground">Logo</div>
                )}
              </div>
              <div className="flex-1 text-center">
                <p className="text-lg font-bold">{String(settings?.church_name ?? "Kanisa la Kiinjili la Kilutheri Tanzania")}</p>
                <p className="text-base">{String(settings?.diocese_name ?? "Dayosisi ya Dodoma")}</p>
                <p className="text-base">{String(settings?.postal_box ?? "P.O.Box 1682 - Dodoma")}</p>
                <div className="mt-6">
                  <p className="text-sm font-medium underline underline-offset-4">CHETI CHA SAFARI</p>
                </div>
              </div>
              <div className="min-w-36 text-right text-sm">
                <p>
                  <span className="font-medium">Certificate No:</span> {certificateNo}
                </p>
                <p className="mt-1">
                  <span className="font-medium">Date:</span> {displayDate}
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-4 text-[15px] leading-7">
              <div className="grid grid-cols-[220px_1fr] gap-3 border-b border-dashed pb-2">
                <p className="font-medium">Jina</p>
                <p>{String(certificate.member_name ?? "—")}</p>
              </div>
              <div className="grid grid-cols-[220px_1fr] gap-3 border-b border-dashed pb-2">
                <p className="font-medium">Usharika anaotoka</p>
                <p>{String(certificate.from_congregation ?? "—")}</p>
              </div>
              <div className="grid grid-cols-[220px_1fr] gap-3 border-b border-dashed pb-2">
                <p className="font-medium">Jumuiya</p>
                <p>{certificateHousehold}</p>
              </div>
              <div className="grid grid-cols-[220px_1fr] gap-3 border-b border-dashed pb-2">
                <p className="font-medium">Namba ya Bahasha</p>
                <p>{String(certificate.offering_number ?? "—")}</p>
              </div>
              <div className="grid grid-cols-[220px_1fr] gap-3 border-b border-dashed pb-2">
                <p className="font-medium">Ameoa / Ameolewa</p>
                <p>{boolText(certificate.is_married)}</p>
              </div>
              <div className="grid grid-cols-[220px_1fr] gap-3 border-b border-dashed pb-2">
                <p className="font-medium">Amebatizwa</p>
                <p>{boolText(certificate.is_baptized)}</p>
              </div>
              <div className="grid grid-cols-[220px_1fr] gap-3 border-b border-dashed pb-2">
                <p className="font-medium">Anashiriki Sakrament</p>
                <p>{boolText(certificate.takes_holy_communion)}</p>
              </div>
              <div className="grid grid-cols-[220px_1fr] gap-3 border-b border-dashed pb-2">
                <p className="font-medium">Usharika anaoenda</p>
                <p>{String(certificate.to_congregation ?? "—")}</p>
              </div>
              {requestKind === "dependent" ? (
                <>
                  <div className="grid grid-cols-[220px_1fr] gap-3 border-b border-dashed pb-2">
                    <p className="font-medium">Mtegemezi</p>
                    <p>{String(certificate.dependent_name ?? "—")}</p>
                  </div>
                  <div className="grid grid-cols-[220px_1fr] gap-3 border-b border-dashed pb-2">
                    <p className="font-medium">Umri wa Mtegemezi</p>
                    <p>{String(certificate.dependent_age ?? "—")}</p>
                  </div>
                  <div className="grid grid-cols-[220px_1fr] gap-3 border-b border-dashed pb-2">
                    <p className="font-medium">Mawasiliano ya Mtegemezi</p>
                    <p>{String(certificate.dependent_contacts ?? "—")}</p>
                  </div>
                </>
              ) : null}
              <div className="grid grid-cols-[220px_1fr] gap-3 border-b border-dashed pb-2">
                <p className="font-medium">Kusudi la Safari</p>
                <p>{String(certificate.travel_purpose ?? "—")}</p>
              </div>
              <div className="grid grid-cols-[220px_1fr] gap-3 border-b border-dashed pb-2">
                <p className="font-medium">Mengineyo / Comment</p>
                <p>{String(certificate.other_notes ?? "—")}</p>
              </div>
              {String(certificate.reject_reason ?? "").trim() ? (
                <div className="grid grid-cols-[220px_1fr] gap-3 border-b border-dashed pb-2 text-destructive">
                  <p className="font-medium">Reject reason</p>
                  <p>{String(certificate.reject_reason ?? "")}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-10 flex items-end justify-between gap-6 border-t pt-6">
              <div className="max-w-md">
                {previewSignature ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewSignature}
                    alt="Issuer signature"
                    className="h-16 w-48 object-contain"
                  />
                ) : null}
                <p className="mt-2 text-sm">
                  <span className="font-medium">Issuer:</span> {String(certificate.signer_name ?? "Pending")}
                </p>
              </div>
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border bg-white">
                {previewStamp ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewStamp}
                    alt="Church stamp"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-muted-foreground">Stamp</div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Certificate details and actions</CardTitle>
          </CardHeader>
          <CardContent>
          <form onSubmit={(e) => void onSave(e)} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={String(certificate.id ?? "")} />
            <input type="hidden" name="member_user_id" value={String(certificate.member_user_id ?? "")} />
            <input type="hidden" name="request_kind" value={requestKind} />

            <div className="grid gap-2">
              <Label htmlFor="member_name">Jina</Label>
              <Input
                id="member_name"
                name="member_name"
                defaultValue={String(certificate.member_name ?? "")}
                readOnly={disableForm || lockRequestFields}
                className={disableForm || lockRequestFields ? "bg-muted" : ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="from_congregation">Usharika anaotoka</Label>
              <Input
                id="from_congregation"
                name="from_congregation"
                defaultValue={String(certificate.from_congregation ?? "")}
                readOnly={disableForm || lockRequestFields}
                className={disableForm || lockRequestFields ? "bg-muted" : ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="household_id">Jumuiya</Label>
              <select
                id="household_id"
                name="household_id"
                defaultValue={String(certificate.household_id ?? "")}
                disabled={disableForm || lockRequestFields}
                className="h-10 rounded-md border border-input bg-background px-3 disabled:bg-muted"
              >
                <option value="">— Chagua Jumuiya —</option>
                {households.map((h) => (
                  <option key={h.id} value={h.id}>
                    {String(h.name ?? h.id)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="offering_number">Namba ya Bahasha</Label>
              <Input
                id="offering_number"
                name="offering_number"
                defaultValue={String(certificate.offering_number ?? "")}
                readOnly={disableForm || lockRequestFields}
                className={disableForm || lockRequestFields ? "bg-muted" : ""}
              />
            </div>
            <div className="grid gap-2">
              <Label>Ameoa / Ameolewa</Label>
              <select
                name="is_married"
                defaultValue={certificate.is_married ? "true" : "false"}
                disabled={disableForm || lockRequestFields}
                className="h-10 rounded-md border border-input bg-background px-3 disabled:bg-muted"
              >
                <option value="true">Ndiyo</option>
                <option value="false">Hapana</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Amebatizwa</Label>
              <select
                name="is_baptized"
                defaultValue={certificate.is_baptized ? "true" : "false"}
                disabled={disableForm || lockRequestFields}
                className="h-10 rounded-md border border-input bg-background px-3 disabled:bg-muted"
              >
                <option value="true">Ndiyo</option>
                <option value="false">Hapana</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Anashiriki Sakrament</Label>
              <select
                name="takes_holy_communion"
                defaultValue={certificate.takes_holy_communion ? "true" : "false"}
                disabled={disableForm || lockRequestFields}
                className="h-10 rounded-md border border-input bg-background px-3 disabled:bg-muted"
              >
                <option value="true">Ndiyo</option>
                <option value="false">Hapana</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="to_congregation">Usharika anaoenda</Label>
              <Input
                id="to_congregation"
                name="to_congregation"
                defaultValue={String(certificate.to_congregation ?? "")}
                readOnly={disableForm || lockRequestFields}
                className={disableForm || lockRequestFields ? "bg-muted" : ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="travel_purpose">Kusudi la Safari</Label>
              <Input
                id="travel_purpose"
                name="travel_purpose"
                defaultValue={String(certificate.travel_purpose ?? "")}
                readOnly={disableForm || lockRequestFields}
                className={disableForm || lockRequestFields ? "bg-muted" : ""}
              />
            </div>

            {requestKind === "dependent" ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="dependent_name">Dependent name</Label>
                  <Input
                    id="dependent_name"
                    name="dependent_name"
                    defaultValue={String(certificate.dependent_name ?? "")}
                    readOnly={disableForm || lockRequestFields}
                    className={disableForm || lockRequestFields ? "bg-muted" : ""}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dependent_age">Dependent age</Label>
                  <Input
                    id="dependent_age"
                    name="dependent_age"
                    defaultValue={String(certificate.dependent_age ?? "")}
                    readOnly={disableForm || lockRequestFields}
                    className={disableForm || lockRequestFields ? "bg-muted" : ""}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="dependent_contacts">Dependent contacts</Label>
                  <Input
                    id="dependent_contacts"
                    name="dependent_contacts"
                    defaultValue={String(certificate.dependent_contacts ?? "")}
                    readOnly={disableForm || lockRequestFields}
                    className={disableForm || lockRequestFields ? "bg-muted" : ""}
                  />
                </div>
              </>
            ) : null}

            <div className="grid gap-2">
              <Label>Status</Label>
              <select
                name="status"
                defaultValue={String(certificate.status ?? "draft")}
                disabled={!canManage || isIssued}
                className="h-10 rounded-md border border-input bg-background px-3 disabled:bg-muted"
              >
                <option value="draft">Draft</option>
                <option value="requested">Requested</option>
                <option value="rejected">Rejected</option>
                <option value="issued">Issued</option>
              </select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="reject_reason">Reject reason</Label>
              <Textarea
                id="reject_reason"
                name="reject_reason"
                rows={2}
                defaultValue={String(certificate.reject_reason ?? "")}
                readOnly={!canManage || isIssued}
                className={!canManage || isIssued ? "bg-muted" : ""}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="other_notes">Mengineyo / Comment</Label>
              <Textarea
                id="other_notes"
                name="other_notes"
                rows={3}
                defaultValue={String(certificate.other_notes ?? "")}
                readOnly={!canManage || isIssued}
                className={!canManage || isIssued ? "bg-muted" : ""}
              />
            </div>

            {canManage ? (
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <Button type="submit" disabled={isIssued}>
                  Update Certificate
                </Button>
                {canIssue && !isIssued ? (
                  <Button type="button" onClick={() => void onIssue()}>
                    Issue Certificate
                  </Button>
                ) : null}
                {canIssue && !isIssued ? (
                  <Button type="button" variant="destructive" onClick={() => void onReject()}>
                    Reject with reason
                  </Button>
                ) : null}
              </div>
            ) : null}
          </form>
        </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
