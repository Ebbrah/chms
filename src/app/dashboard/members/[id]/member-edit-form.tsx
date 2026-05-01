"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  getHouseholdLeaderIdsForForm,
  revokeUserIfNoOfferingNumber,
  upsertMemberForUser,
} from "@/lib/actions/members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Member = Record<string, unknown> & { id?: string; offering_number?: string | null };
type Household = { id: string; name?: string | null };
type ChildRow = { full_name: string; birth_date: string; relationship: string };
type ElderOpt = { id: string; full_name?: string | null };
type ChairOpt = { householdId: string; userId: string; fullName: string; jumuiyaLabel: string };

const MARITAL_OPTIONS = [
  "Umeoa",
  "Hujaoa",
  "Umeolewa",
  "Hujaolewa",
  "Mgane",
  "Mjane",
] as const;

const YES_NO_OPTIONS = ["Ndio", "Hapana"] as const;

const MINISTRY_OPTIONS = [
  "Kwaya Kuu",
  "Kwaya ya Uinjilist",
  "Kwaya ya Kinamama",
  "Kwaya ya Kinababa",
  "Kwaya ya Vijana",
  "Praise & Worship",
  "Umoja wa Vijana",
  "Umoja wa Akina mama",
  "Umoja wa Akina baba",
  "Kufundisha Dini Shuleni",
  "Kufundisha Shule ya Jumapili",
  "Kutembelea wagonjwa",
  "Kuhubiri",
  "Bible Study",
] as const;

function detailsOf(member: Member) {
  if (!member.member_details || typeof member.member_details !== "object") return {};
  return member.member_details as Record<string, string>;
}

export function MemberEditForm({
  userId,
  fullName,
  email,
  member,
  households,
  churchElderOptions,
  jumuiyaChairOptions,
  allowEditDisplayName,
}: {
  userId: string;
  fullName: string;
  email: string;
  member: Member | null;
  households: Household[];
  churchElderOptions: ElderOpt[];
  jumuiyaChairOptions: ChairOpt[];
  allowEditDisplayName: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(fullName);
  useEffect(() => {
    setDisplayName(fullName);
  }, [fullName]);
  const details = detailsOf(member ?? {}) as Record<string, unknown>;
  const [householdId, setHouseholdId] = useState<string>(
    String(member?.household_id ?? "__none__"),
  );
  const [maritalStatus, setMaritalStatus] = useState(
    String(details.marital_status ?? ""),
  );
  const [gender, setGender] = useState(String(details.gender ?? ""));
  const [marriageType, setMarriageType] = useState(String(details.marriage_type ?? ""));
  const [isBaptized, setIsBaptized] = useState(String(details.is_baptized ?? ""));
  const [hasConfirmation, setHasConfirmation] = useState(
    String(details.has_confirmation ?? ""),
  );
  const [takesHolyCommunion, setTakesHolyCommunion] = useState(
    String(details.takes_holy_communion ?? ""),
  );
  const [participatesInJumuiya, setParticipatesInJumuiya] = useState(
    String(details.participates_in_jumuiya ?? ""),
  );
  const [churchElderUserId, setChurchElderUserId] = useState(
    String(details.church_elder_user_id ?? ""),
  );
  const [jumuiyaChairHouseholdId, setJumuiyaChairHouseholdId] = useState(() => {
    const hid = String(member?.household_id ?? "");
    if (hid && jumuiyaChairOptions.some((o) => o.householdId === hid)) return hid;
    const uid = String(details.jumuiya_chairperson_user_id ?? "");
    if (uid) {
      const o = jumuiyaChairOptions.find((x) => x.userId === uid);
      return o?.householdId ?? "";
    }
    return "";
  });
  const [photoDataUrl, setPhotoDataUrl] = useState(
    String(details.passport_photo_url ?? details.passport_photo_data_url ?? ""),
  );
  const [photoChanged, setPhotoChanged] = useState(false);
  const [ministries, setMinistries] = useState<string[]>(
    Array.isArray(details.ministries)
      ? details.ministries.map((v) => String(v))
      : [],
  );
  const initialChildren: ChildRow[] = useMemo(() => {
    const source = Array.isArray(details.children) ? details.children : [];
    const normalized = source.map((r) => ({
      full_name: String((r as Record<string, unknown>).full_name ?? ""),
      birth_date: String((r as Record<string, unknown>).birth_date ?? ""),
      relationship: String((r as Record<string, unknown>).relationship ?? ""),
    }));
    while (normalized.length < 7) {
      normalized.push({ full_name: "", birth_date: "", relationship: "" });
    }
    return normalized.slice(0, 7);
  }, [details.children]);
  const [children, setChildren] = useState<ChildRow[]>(initialChildren);
  const spouseFieldsEnabled = maritalStatus === "Umeoa" || maritalStatus === "Umeolewa";

  function onPhotoPicked(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoChanged(true);
      setPhotoDataUrl(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(file);
  }

  function toggleMinistry(ministry: string, checked: boolean) {
    setMinistries((prev) => {
      if (checked) return [...prev, ministry];
      return prev.filter((m) => m !== ministry);
    });
  }

  function updateChildRow(index: number, key: keyof ChildRow, value: string) {
    setChildren((prev) => prev.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }

  async function onHouseholdChange(v: string) {
    setHouseholdId(v);
    setMsg(null);
    if (v === "__none__") {
      setJumuiyaChairHouseholdId("");
      setChurchElderUserId("");
      return;
    }
    const chairHouseholdOk = jumuiyaChairOptions.some((o) => o.householdId === v);
    setJumuiyaChairHouseholdId(chairHouseholdOk ? v : "");
    const res = await getHouseholdLeaderIdsForForm(v);
    if ("error" in res) {
      setMsg(typeof res.error === "string" ? res.error : "Hitilafu");
      return;
    }
    setChurchElderUserId(res.elderUserId ?? "");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set("household_id", householdId === "__none__" ? "" : householdId);
    fd.set("gender", gender);
    fd.set("marital_status", maritalStatus);
    fd.set("marriage_type", marriageType);
    fd.set("is_baptized", isBaptized);
    fd.set("has_confirmation", hasConfirmation);
    fd.set("takes_holy_communion", takesHolyCommunion);
    fd.set("participates_in_jumuiya", participatesInJumuiya);
    fd.set("church_elder_user_id", churchElderUserId);
    const chairPick = jumuiyaChairOptions.find((o) => o.householdId === jumuiyaChairHouseholdId);
    fd.set("jumuiya_chairperson_user_id", chairPick?.userId ?? "");
    fd.set("full_name", displayName);
    if (photoChanged && photoDataUrl.startsWith("data:image/")) {
      fd.set("passport_photo_data_url", photoDataUrl);
    }
    ministries.forEach((m) => fd.append("ministries", m));
    children.forEach((row, i) => {
      fd.set(`child_full_name_${i}`, row.full_name);
      fd.set(`child_birth_date_${i}`, row.birth_date);
      fd.set(`child_relationship_${i}`, row.relationship);
    });
    const res = await upsertMemberForUser(userId, fd);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    setMsg("Saved successfully.");
    router.refresh();
  }

  async function onDelete() {
    if (
      !confirm(
        "Revoke this registered user? Admins can revoke even when offering number exists.",
      )
    ) {
      return;
    }
    const res = await revokeUserIfNoOfferingNumber(userId);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    router.push("/dashboard/members");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Member profile verification</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4 sm:grid-cols-2">
          {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
          <div className="grid gap-2">
            <Label htmlFor="full_name">Member full name</Label>
            <Input
              id="full_name"
              name="full_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              readOnly={!allowEditDisplayName}
              aria-readonly={!allowEditDisplayName}
            />
            {!allowEditDisplayName ? (
              <p className="text-xs text-muted-foreground">Only finance (treasurer / admin) can edit this name.</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Barua pepe</Label>
            <Input
              id="email"
              name="email"
              value={email}
              readOnly
            />
          </div>
          <div className="grid gap-2">
            <Label>Member passport photo</Label>
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => onPhotoPicked(e.target.files?.[0] ?? null)}
            />
            {photoDataUrl ? (
              <Image
                src={photoDataUrl}
                alt="Passport preview"
                className="h-24 w-20 rounded border object-cover"
                width={80}
                height={96}
                unoptimized={!photoDataUrl.startsWith("data:")}
              />
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="offering_number">Namba ya msharika (offering number)</Label>
            <Input
              id="offering_number"
              name="offering_number"
              defaultValue={String(member?.offering_number ?? "")}
              readOnly
            />
            <p className="text-xs text-muted-foreground">Managed from uploaded seed data.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gender">Jinsia</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue placeholder="Chagua jinsia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mwanamume">Mwanamume</SelectItem>
                <SelectItem value="Mwanamke">Mwanamke</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="birth_date">Tarehe ya kuzaliwa</Label>
            <Input
              id="birth_date"
              name="birth_date"
              type="date"
              defaultValue={String(details.birth_date ?? "")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="birth_place">Mahali pa kuzaliwa</Label>
            <Input
              id="birth_place"
              name="birth_place"
              defaultValue={String(details.birth_place ?? "")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="marital_status">Hali ya ndoa</Label>
            <Select value={maritalStatus} onValueChange={setMaritalStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Chagua hali ya ndoa" />
              </SelectTrigger>
              <SelectContent>
                {MARITAL_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="spouse_name">Jina la mwenzi</Label>
            <Input
              id="spouse_name"
              name="spouse_name"
              defaultValue={String(details.spouse_name ?? "")}
              disabled={!spouseFieldsEnabled}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="marriage_type">Aina ya ndoa</Label>
            <Select
              value={marriageType}
              onValueChange={setMarriageType}
              disabled={!spouseFieldsEnabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chagua aina ya ndoa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ndoa ya Kikristo">Ndoa ya Kikristo</SelectItem>
                <SelectItem value="Bomani">Bomani</SelectItem>
                <SelectItem value="Kimila">Kimila</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="marriage_date">Tarehe ya ndoa</Label>
            <Input
              id="marriage_date"
              name="marriage_date"
              type="date"
              defaultValue={String(details.marriage_date ?? "")}
              disabled={!spouseFieldsEnabled}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Namba ya simu (yako)</Label>
            <Input id="phone" name="phone" defaultValue={String(member?.phone ?? "")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="spouse_phone">Namba ya simu (mwenzi)</Label>
            <Input
              id="spouse_phone"
              name="spouse_phone"
              defaultValue={String(details.spouse_phone ?? "")}
              disabled={!spouseFieldsEnabled}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="address">Mtaa / Address</Label>
            <Input id="address" name="address" defaultValue={String(member?.address ?? "")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="postal_address">Sanduku la barua</Label>
            <Input
              id="postal_address"
              name="postal_address"
              defaultValue={String(details.postal_address ?? "")}
            />
          </div>
          <div className="grid gap-2">
            <Label>Mzee wa kanisa</Label>
            <Select
              value={churchElderUserId ? churchElderUserId : "__none__"}
              onValueChange={(v) => setChurchElderUserId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chagua mzee aliyeandikwa kwenye jumuiya" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {churchElderOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {String(p.full_name ?? "").trim() || p.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Orodha inatoka kwa wanaohusika walio na jukumu &quot;Mzee wa kanisa&quot; kwenye ukurasa wa
              Majukumu.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="occupation">Kazi/Shughuli</Label>
            <Input
              id="occupation"
              name="occupation"
              defaultValue={String(details.occupation ?? "")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="education_level">Elimu</Label>
            <Input
              id="education_level"
              name="education_level"
              defaultValue={String(details.education_level ?? "")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profession">Ujuzi/Profession</Label>
            <Input
              id="profession"
              name="profession"
              defaultValue={String(details.profession ?? "")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="work_place">Mahala pa kazi</Label>
            <Input
              id="work_place"
              name="work_place"
              defaultValue={String(details.work_place ?? "")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="is_baptized">Umebatizwa?</Label>
            <Select value={isBaptized} onValueChange={setIsBaptized}>
              <SelectTrigger>
                <SelectValue placeholder="Chagua" />
              </SelectTrigger>
              <SelectContent>
                {YES_NO_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="has_confirmation">Kipaimara?</Label>
            <Select value={hasConfirmation} onValueChange={setHasConfirmation}>
              <SelectTrigger>
                <SelectValue placeholder="Chagua" />
              </SelectTrigger>
              <SelectContent>
                {YES_NO_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="takes_holy_communion">Unashiriki sakramenti?</Label>
            <Select value={takesHolyCommunion} onValueChange={setTakesHolyCommunion}>
              <SelectTrigger>
                <SelectValue placeholder="Chagua" />
              </SelectTrigger>
              <SelectContent>
                {YES_NO_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="participates_in_jumuiya">Unashiriki Jumuiya?</Label>
            <Select value={participatesInJumuiya} onValueChange={setParticipatesInJumuiya}>
              <SelectTrigger>
                <SelectValue placeholder="Chagua" />
              </SelectTrigger>
              <SelectContent>
                {YES_NO_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Jina la Jumuiya</Label>
            <Select value={householdId} onValueChange={(v) => void onHouseholdChange(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Not assigned</SelectItem>
                {households.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name ?? h.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Mwenyekiti wa Jumuiya</Label>
            <Select
              value={jumuiyaChairHouseholdId ? jumuiyaChairHouseholdId : "__none__"}
              onValueChange={(v) => setJumuiyaChairHouseholdId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chagua mwenyekiti aliyeandikwa kwenye jumuiya" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {jumuiyaChairOptions.map((c) => (
                  <SelectItem key={c.householdId} value={c.householdId}>
                    {c.fullName} — {c.jumuiyaLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Majina yanatoka kwenye mipangilio ya kila jumuiya (mwenyekiti aliyesajiliwa).
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="join_date">Tarehe ya kujiunga</Label>
            <Input
              id="join_date"
              name="join_date"
              type="date"
              defaultValue={String(member?.join_date ?? "")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Input id="status" name="status" defaultValue={String(member?.status ?? "active")} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>
              Watoto/Waumini wanaokutegemea (wasio na bahasha bali wapo chini ya
              usimamizi wako)
            </Label>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-2 py-2 text-left">Jina Kamili</th>
                    <th className="px-2 py-2 text-left">Tarehe ya kuzaliwa</th>
                    <th className="px-2 py-2 text-left">Uhusiano</th>
                  </tr>
                </thead>
                <tbody>
                  {children.map((row, index) => (
                    <tr key={`child-row-${index}`} className="border-t">
                      <td className="px-2 py-1">
                        <Input
                          value={row.full_name}
                          onChange={(e) => updateChildRow(index, "full_name", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="date"
                          value={row.birth_date}
                          onChange={(e) => updateChildRow(index, "birth_date", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          value={row.relationship}
                          onChange={(e) => updateChildRow(index, "relationship", e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="ministries">Je, ungependa kujiunga na huduma gani?</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {MINISTRY_OPTIONS.map((opt) => {
                const checked = ministries.includes(opt);
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-2 rounded-md border px-2 py-2"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleMinistry(opt, v === true)}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="notes">General notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={String(member?.notes ?? "")}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="pastoral_notes">Pastoral notes</Label>
            <Textarea
              id="pastoral_notes"
              name="pastoral_notes"
              rows={3}
              defaultValue={String(member?.pastoral_notes ?? "")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pledge_1">Ahadi 1</Label>
            <Input
              id="pledge_1"
              name="pledge_1"
              defaultValue={String(details.pledge_1 ?? "")}
              readOnly
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pledge_2">Ujenzi/Maendeleo ya Usharika</Label>
            <Input
              id="pledge_2"
              name="pledge_2"
              defaultValue={String(details.pledge_2 ?? "")}
              readOnly
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="pledge_3">Maendeleo ya Dayosisi</Label>
            <Input
              id="pledge_3"
              name="pledge_3"
              defaultValue={String(details.pledge_3 ?? "")}
              readOnly
            />
            <p className="text-xs text-muted-foreground">
              Pledge values are updated from seed data using the Load data action.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit">Save</Button>
            <Button type="button" variant="destructive" onClick={() => void onDelete()}>
              Revoke user
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
