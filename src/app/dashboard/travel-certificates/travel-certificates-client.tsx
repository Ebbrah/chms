"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  canIssueTravelCertificates,
  canManageTravelCertificates,
} from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/auth/roles";
import {
  requestTravelCertificate,
  saveMyIssuerAssets,
  saveCertificateSettings,
  upsertTravelCertificateByStaff,
} from "@/lib/actions/travel-certificates";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = Record<string, unknown>;
type ProfileRow = { id: string; full_name: string | null };
type HouseholdRow = { id: string; name: string | null };
type DependantRow = {
  key: string;
  name: string;
  age: string;
  contacts: string;
  relationship: string;
};

export function TravelCertificatesClient({
  roles,
  profileName,
  profilePhone,
  settings,
  certificates,
  profiles,
  households,
  memberOfferingNumber,
  memberHouseholdId,
  memberIsBaptized,
  memberIsMarried,
  memberCommunion,
  dependants,
  issuerAssets,
}: {
  roles: AppRole[];
  profileName: string;
  profilePhone: string;
  settings: Row | null;
  certificates: Row[];
  profiles: ProfileRow[];
  households: HouseholdRow[];
  memberOfferingNumber: string;
  memberHouseholdId: string;
  memberIsBaptized: string;
  memberIsMarried: string;
  memberCommunion: string;
  dependants: DependantRow[];
  issuerAssets: { signature_url?: string | null; stamp_url?: string | null } | null;
}) {
  const router = useRouter();
  const canManage = canManageTravelCertificates(roles);
  const canIssue = canIssueTravelCertificates(roles);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgIsError, setMsgIsError] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [defaultSignatureDataUrl, setDefaultSignatureDataUrl] = useState("");
  const [defaultStampDataUrl, setDefaultStampDataUrl] = useState("");
  const [issuerSignatureDataUrl, setIssuerSignatureDataUrl] = useState("");
  const [issuerStampDataUrl, setIssuerStampDataUrl] = useState("");
  const [requestForDependent, setRequestForDependent] = useState(false);
  const [selectedDependantKey, setSelectedDependantKey] = useState("");
  const [manualDependantName, setManualDependantName] = useState("");
  const [manualDependantAge, setManualDependantAge] = useState("");
  const [manualDependantContacts, setManualDependantContacts] = useState("");

  const householdLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of households) {
      map.set(String(h.id), String(h.name ?? h.id));
    }
    return map;
  }, [households]);

  const selectedDependant = dependants.find((row) => row.key === selectedDependantKey) ?? null;
  const requestRows = certificates.filter((row) => String(row.status ?? "") === "requested");
  const createdRows = certificates.filter((row) => String(row.status ?? "") !== "requested");

  function onPickImage(file: File | null, setter: (v: string) => void) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  async function onMemberRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setMsgIsError(false);
    const fd = new FormData(e.currentTarget);
    const res = await requestTravelCertificate(fd);
    if ("error" in res && res.error) {
      setMsgIsError(true);
      setMsg(res.error);
      return;
    }
    setMsgIsError(false);
    setMsg("Travel certificate request submitted.");
    const form = e.currentTarget as HTMLFormElement;
    form.reset();
    setRequestForDependent(false);
    setSelectedDependantKey("");
    setManualDependantName("");
    setManualDependantAge("");
    setManualDependantContacts("");
    router.refresh();
  }

  async function onStaffSubmit(e: React.FormEvent<HTMLFormElement>) {
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
    setMsgIsError(false);
    setMsg("Certificate created successfully.");
    (e.currentTarget as HTMLFormElement).reset();
    router.refresh();
  }

  async function onSaveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setMsgIsError(false);
    const fd = new FormData(e.currentTarget);
    if (logoDataUrl) fd.set("logo_data_url", logoDataUrl);
    if (defaultSignatureDataUrl) fd.set("pastor_signature_data_url", defaultSignatureDataUrl);
    if (defaultStampDataUrl) fd.set("pastor_stamp_data_url", defaultStampDataUrl);
    const res = await saveCertificateSettings(fd);
    if ("error" in res && res.error) {
      setMsgIsError(true);
      setMsg(res.error);
      return;
    }
    setMsgIsError(false);
    setMsg("Certificate settings saved.");
    setLogoDataUrl("");
    setDefaultSignatureDataUrl("");
    setDefaultStampDataUrl("");
    router.refresh();
  }

  async function onSaveIssuerAssets(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setMsgIsError(false);
    const fd = new FormData(e.currentTarget);
    if (issuerSignatureDataUrl) fd.set("signature_data_url", issuerSignatureDataUrl);
    if (issuerStampDataUrl) fd.set("stamp_data_url", issuerStampDataUrl);
    const res = await saveMyIssuerAssets(fd);
    if ("error" in res && res.error) {
      setMsgIsError(true);
      setMsg(res.error);
      return;
    }
    setMsg("Issuer signature and stamp saved.");
    setIssuerSignatureDataUrl("");
    setIssuerStampDataUrl("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Travel certificate (Cheti cha Safari)</h1>
        <p className="text-sm text-muted-foreground">
          Members can request certificates; authorized leaders can draft, review, and issue.
        </p>
      </div>

      {msg ? (
        <Alert variant={msgIsError ? "destructive" : "default"}>
          <AlertTitle>{msgIsError ? "Could not save" : "Done"}</AlertTitle>
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      ) : null}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Certificate template settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void onSaveSettings(e)} className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="jina_la_usharika">Jina la Usharika</Label>
                <Input
                  id="jina_la_usharika"
                  name="jina_la_usharika"
                  placeholder="Mfano: Dayosisi ya Dodoma — Usharika wa ..."
                  defaultValue={String(settings?.jina_la_usharika ?? "")}
                />
                <p className="text-xs text-muted-foreground">
                  Huo ndio maandishi ya &quot;Usharika anaotoka&quot; kwenye fomu ya mwanachama na cheti.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="church_name">Church heading line 1</Label>
                <Input
                  id="church_name"
                  name="church_name"
                  defaultValue={String(settings?.church_name ?? "Kanisa la Kiinjili la Kilutheri Tanzania")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="diocese_name">Church heading line 2</Label>
                <Input
                  id="diocese_name"
                  name="diocese_name"
                  defaultValue={String(settings?.diocese_name ?? "Dayosisi ya Dodoma")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="postal_box">Church heading line 3</Label>
                <Input
                  id="postal_box"
                  name="postal_box"
                  defaultValue={String(settings?.postal_box ?? "P.O.Box 1682 - Dodoma")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="next_certificate_number">Next certificate number</Label>
                <Input
                  id="next_certificate_number"
                  name="next_certificate_number"
                  type="number"
                  min={1}
                  defaultValue={String(settings?.next_certificate_number ?? 1)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Church logo</Label>
                <Input type="file" accept="image/*" onChange={(e) => onPickImage(e.target.files?.[0] ?? null, setLogoDataUrl)} />
              </div>
              <div className="grid gap-2">
                <Label>Default signature image</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    onPickImage(e.target.files?.[0] ?? null, setDefaultSignatureDataUrl)
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Default stamp image</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onPickImage(e.target.files?.[0] ?? null, setDefaultStampDataUrl)}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Save settings</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {canIssue ? (
        <Card>
          <CardHeader>
            <CardTitle>My issuer signature and stamp</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void onSaveIssuerAssets(e)} className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>My signature</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onPickImage(e.target.files?.[0] ?? null, setIssuerSignatureDataUrl)}
                />
                <p className="text-xs text-muted-foreground">
                  Current: {String(issuerAssets?.signature_url ?? "").trim() ? "Saved" : "Not saved yet"}
                </p>
              </div>
              <div className="grid gap-2">
                <Label>My stamp</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onPickImage(e.target.files?.[0] ?? null, setIssuerStampDataUrl)}
                />
                <p className="text-xs text-muted-foreground">
                  Current: {String(issuerAssets?.stamp_url ?? "").trim() ? "Saved" : "Not saved yet"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Save my issuer assets</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Member certificate request</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onMemberRequest(e)} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center gap-3 rounded-md border p-3">
              <input
                id="request_for_dependent"
                type="checkbox"
                checked={requestForDependent}
                onChange={(e) => {
                  setRequestForDependent(e.target.checked);
                  setSelectedDependantKey("");
                  setManualDependantName("");
                  setManualDependantAge("");
                  setManualDependantContacts("");
                }}
              />
              <Label htmlFor="request_for_dependent" className="cursor-pointer">
                This request is for my dependant
              </Label>
            </div>
            <input type="hidden" name="request_kind" value={requestForDependent ? "dependent" : "self"} />
            <div className="grid gap-2">
              <Label htmlFor="member_name">Jina</Label>
              <Input id="member_name" name="member_name" value={profileName} readOnly className="bg-muted" />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="from_congregation_display">Usharika anaotoka (Jina la Usharika)</Label>
              <Input
                id="from_congregation_display"
                readOnly
                className="bg-muted"
                value={String(settings?.jina_la_usharika ?? "")}
              />
              <input type="hidden" name="from_congregation" value={String(settings?.jina_la_usharika ?? "")} />
              <p className="text-xs text-muted-foreground">
                Imepakuliwa kiotomatiki kutoka kwenye sehemu ya &quot;Jina la Usharika&quot; hapo juu (Mipangilio ya Cheti).
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="household_display_member">Jumuiya</Label>
              <Input
                id="household_display_member"
                value={householdLookup.get(memberHouseholdId) ?? ""}
                readOnly
                className="bg-muted"
              />
              <input type="hidden" name="household_id" value={memberHouseholdId} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="offering_number_member">Namba ya Bahasha</Label>
              <Input
                id="offering_number_member"
                readOnly
                className="bg-muted"
                defaultValue={memberOfferingNumber}
                aria-label="Namba ya Bahasha"
              />
            </div>
            {requestForDependent ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="dependant_select">Registered dependant</Label>
                  <select
                    id="dependant_select"
                    value={selectedDependantKey}
                    onChange={(e) => setSelectedDependantKey(e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3"
                  >
                    <option value="">— Chagua mtegemezi —</option>
                    {dependants.map((row) => (
                      <option key={row.key} value={row.key}>
                        {row.name} ({row.relationship})
                      </option>
                    ))}
                    <option value="__manual__">Not in list / add manually</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dependent_name">Name of dependant</Label>
                  <Input
                    id="dependent_name"
                    name="dependent_name"
                    value={selectedDependant && selectedDependantKey !== "__manual__" ? selectedDependant.name : manualDependantName}
                    readOnly={Boolean(selectedDependant && selectedDependantKey !== "__manual__")}
                    onChange={(e) => setManualDependantName(e.target.value)}
                    className={selectedDependant && selectedDependantKey !== "__manual__" ? "bg-muted" : ""}
                    required={requestForDependent}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dependent_age">Age</Label>
                  <Input
                    id="dependent_age"
                    name="dependent_age"
                    value={selectedDependant && selectedDependantKey !== "__manual__" ? selectedDependant.age : manualDependantAge}
                    readOnly={Boolean(selectedDependant && selectedDependantKey !== "__manual__")}
                    onChange={(e) => setManualDependantAge(e.target.value)}
                    className={selectedDependant && selectedDependantKey !== "__manual__" ? "bg-muted" : ""}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dependent_contacts">Contacts</Label>
                  <Input
                    id="dependent_contacts"
                    name="dependent_contacts"
                    value={
                      selectedDependant && selectedDependantKey !== "__manual__"
                        ? selectedDependant.contacts
                        : manualDependantContacts
                    }
                    readOnly={Boolean(selectedDependant && selectedDependantKey !== "__manual__")}
                    onChange={(e) => setManualDependantContacts(e.target.value)}
                    className={selectedDependant && selectedDependantKey !== "__manual__" ? "bg-muted" : ""}
                    placeholder={profilePhone || "Phone / contacts"}
                  />
                </div>
              </>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="to_congregation">Usharika anaoenda</Label>
              <Input id="to_congregation" name="to_congregation" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="travel_purpose">Kusudi la Safari</Label>
              <Input id="travel_purpose" name="travel_purpose" />
            </div>
            <div className="grid gap-2">
              <Label>Amebatizwa</Label>
              <select
                name="is_baptized"
                defaultValue={memberIsBaptized.toLowerCase().includes("ndiyo") ? "true" : "false"}
                className="h-10 rounded-md border border-input bg-background px-3"
              >
                <option value="true">Ndiyo</option>
                <option value="false">Hapana</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Ameoa / Ameolewa</Label>
              <select
                name="is_married"
                defaultValue={
                  memberIsMarried.toLowerCase().includes("oa") ||
                  memberIsMarried.toLowerCase().includes("olewa")
                    ? "true"
                    : "false"
                }
                className="h-10 rounded-md border border-input bg-background px-3"
              >
                <option value="true">Ndiyo</option>
                <option value="false">Hapana</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Anashiriki Sakrament</Label>
              <select
                name="takes_holy_communion"
                defaultValue={memberCommunion.toLowerCase().includes("ndiyo") ? "true" : "false"}
                className="h-10 rounded-md border border-input bg-background px-3"
              >
                <option value="true">Ndiyo</option>
                <option value="false">Hapana</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Submit request</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Create certificate</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void onStaffSubmit(e)} className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="member_user_id">Linked member user</Label>
                <select
                  id="member_user_id"
                  name="member_user_id"
                  className="h-10 rounded-md border border-input bg-background px-3"
                  defaultValue=""
                >
                  <option value="">Not linked</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {String(p.full_name ?? p.id)}
                    </option>
                  ))}
                </select>
              </div>
              <input type="hidden" name="request_kind" value="manual" />
              <div className="grid gap-2">
                <Label htmlFor="member_name_staff">Jina</Label>
                <Input id="member_name_staff" name="member_name" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="from_congregation_staff">Usharika anaotoka</Label>
                <Input id="from_congregation_staff" name="from_congregation" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="household_id_staff">Jumuiya</Label>
                <select
                  id="household_id_staff"
                  name="household_id"
                  className="h-10 rounded-md border border-input bg-background px-3"
                >
                  <option value="">— Chagua Jumuiya (si lazima) —</option>
                  {households.map((h) => (
                    <option key={h.id} value={h.id}>
                      {String(h.name ?? h.id).trim() || h.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="offering_number_staff">Namba ya Bahasha</Label>
                <Input id="offering_number_staff" name="offering_number" placeholder="Inapakiwa kutoka kwa mwanachama" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="to_congregation_staff">Usharika anaoenda</Label>
                <Input id="to_congregation_staff" name="to_congregation" required />
              </div>
              <div className="grid gap-2">
                <Label>Amebatizwa</Label>
                <select name="is_baptized" className="h-10 rounded-md border border-input bg-background px-3">
                  <option value="true">Ndiyo</option>
                  <option value="false">Hapana</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Ameoa / Ameolewa</Label>
                <select name="is_married" className="h-10 rounded-md border border-input bg-background px-3">
                  <option value="true">Ndiyo</option>
                  <option value="false">Hapana</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Anashiriki Sakrament</Label>
                <select
                  name="takes_holy_communion"
                  className="h-10 rounded-md border border-input bg-background px-3"
                >
                  <option value="true">Ndiyo</option>
                  <option value="false">Hapana</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="travel_purpose_staff">Kusudi la Safari</Label>
                <Input id="travel_purpose_staff" name="travel_purpose" />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <select name="status" className="h-10 rounded-md border border-input bg-background px-3">
                  <option value="draft">Draft</option>
                  <option value="requested">Requested</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="reject_reason_staff">Reject reason</Label>
                <Textarea id="reject_reason_staff" name="reject_reason" rows={2} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="other_notes_staff">Mengineyo / Comment</Label>
                <Textarea id="other_notes_staff" name="other_notes" rows={3} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Create Certificate</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Certificate requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requestRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No certificate requests yet.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Jumuiya</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestRows.map((row) => (
                    <TableRow key={String(row.id ?? "")}>
                      <TableCell>{String(row.member_name ?? "—")}</TableCell>
                      <TableCell>{String(row.request_kind ?? "manual")}</TableCell>
                      <TableCell>{householdLookup.get(String(row.household_id ?? "")) ?? "—"}</TableCell>
                      <TableCell>{String(row.to_congregation ?? "—")}</TableCell>
                      <TableCell>{String(row.status ?? "—")}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/travel-certificates/${String(row.id ?? "")}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Created certificates</CardTitle>
        </CardHeader>
        <CardContent>
          {createdRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No created certificates yet.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Certificate No</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issuer</TableHead>
                    <TableHead>View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {createdRows.map((row) => (
                    <TableRow key={String(row.id ?? "")}>
                      <TableCell>{String(row.member_name ?? "—")}</TableCell>
                      <TableCell>{String(row.certificate_number ?? "Pending")}</TableCell>
                      <TableCell>{String(row.status ?? "—")}</TableCell>
                      <TableCell>{String(row.signer_name ?? "—")}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/travel-certificates/${String(row.id ?? "")}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
