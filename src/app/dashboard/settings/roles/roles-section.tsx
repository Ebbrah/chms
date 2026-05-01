"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { removeUserRole, setUserRole } from "@/lib/actions/roles";
import {
  assignCommitteeHead,
  assignChurchElderToJumuiya,
  assignJumuiyaChairman,
} from "@/lib/actions/role-scopes";
import { APP_ROLES } from "@/lib/auth/roles";
import type { AppRole } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toDisplayCaps } from "@/lib/format/name";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type P = { id: string; full_name?: string | null };
type C = { id: string; name?: string | null };
type H = { id: string; name?: string | null };

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  treasurer: "Treasurer",
  church_elder: "Mzee wa kanisa",
  pastor: "Pastor",
  assistant_pastor: "Assistant Pastor",
  evangelist: "Evangelist",
  committee_head: "Mwenyekiti wa kamati",
  jumuiya_chairman: "Mwenyekiti wa Jumuiya",
  member: "Member",
};

function displayName(profile: P) {
  return toDisplayCaps(String(profile.full_name ?? "").trim() || profile.id.slice(0, 8));
}

function SearchableUserSelect({
  label,
  profiles,
  value,
  onChange,
}: {
  label: string;
  profiles: P[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const hasQuery = query.trim().length > 0;
  const filtered = profiles.filter((p) => displayName(p).toLowerCase().includes(query.toLowerCase())).slice(0, 50);
  const selectedLabel = profiles.find((p) => p.id === value);

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowResults(true);
        }}
        onFocus={() => {
          if (hasQuery) setShowResults(true);
        }}
        placeholder="Andika jina kutafuta..."
      />
      {hasQuery && showResults ? (
        <div className="max-h-48 overflow-y-auto rounded-md border p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">Hakuna matokeo.</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setQuery(displayName(p));
                  setShowResults(false);
                }}
                className={`block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted ${
                  value === p.id ? "bg-muted font-medium" : ""
                }`}
              >
                {displayName(p)}
              </button>
            ))
          )}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Selected: {selectedLabel ? displayName(selectedLabel) : "None"}
      </p>
    </div>
  );
}

export function RolesSection({
  profiles,
  committees,
  households,
  committeeHeadProfiles,
  jumuiyaChairmanProfiles,
  churchElderProfiles,
}: {
  profiles: P[];
  committees: C[];
  households: H[];
  committeeHeadProfiles: P[];
  jumuiyaChairmanProfiles: P[];
  churchElderProfiles: P[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<AppRole>("treasurer");
  const [removeUid, setRemoveUid] = useState("");
  const [removeRole, setRemoveRole] = useState<AppRole>("treasurer");
  const [committeeUserId, setCommitteeUserId] = useState("");
  const [committeeId, setCommitteeId] = useState("");
  const [jumuiyaUserId, setJumuiyaUserId] = useState("");
  const [householdId, setHouseholdId] = useState("");
  const [elderUserId, setElderUserId] = useState("");
  const [elderHouseholdId, setElderHouseholdId] = useState("");

  useEffect(() => {
    if (!userId && profiles[0]) setUserId(profiles[0].id);
    if (!removeUid && profiles[0]) setRemoveUid(profiles[0].id);
    if (!committeeUserId && committeeHeadProfiles[0]) setCommitteeUserId(committeeHeadProfiles[0].id);
    if (!jumuiyaUserId && jumuiyaChairmanProfiles[0]) setJumuiyaUserId(jumuiyaChairmanProfiles[0].id);
    if (!elderUserId && churchElderProfiles[0]) setElderUserId(churchElderProfiles[0].id);
    if (!committeeId && committees[0]) setCommitteeId(committees[0].id);
    if (!householdId && households[0]) setHouseholdId(households[0].id);
    if (!elderHouseholdId && households[0]) setElderHouseholdId(households[0].id);
  }, [
    profiles,
    userId,
    removeUid,
    committeeUserId,
    jumuiyaUserId,
    elderUserId,
    committeeId,
    householdId,
    elderHouseholdId,
    committees,
    households,
    committeeHeadProfiles,
    jumuiyaChairmanProfiles,
    churchElderProfiles,
  ]);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData();
    fd.set("user_id", userId);
    fd.set("role", role);
    const res = await setUserRole(fd);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setMsg("Role added.");
      router.refresh();
    }
  }

  async function onRemove(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const res = await removeUserRole(removeUid, removeRole);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setMsg("Role removed.");
      router.refresh();
    }
  }

  async function onAssignCommittee(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData();
    fd.set("user_id", committeeUserId);
    fd.set("committee_id", committeeId);
    const res = await assignCommitteeHead(fd);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setMsg("Committee assignment saved.");
      router.refresh();
    }
  }

  async function onAssignJumuiya(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData();
    fd.set("user_id", jumuiyaUserId);
    fd.set("household_id", householdId);
    const res = await assignJumuiyaChairman(fd);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setMsg("Jumuiya assignment saved.");
      router.refresh();
    }
  }

  async function onAssignElder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData();
    fd.set("user_id", elderUserId);
    fd.set("household_id", elderHouseholdId);
    const res = await assignChurchElderToJumuiya(fd);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setMsg("Mzee wa kanisa assignment saved.");
      router.refresh();
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add role</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onAdd(e)} className="grid gap-3">
            {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
            <SearchableUserSelect label="User" profiles={profiles} value={userId} onChange={setUserId} />
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Add role</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Remove role</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onRemove(e)} className="grid gap-3">
            <SearchableUserSelect label="User" profiles={profiles} value={removeUid} onChange={setRemoveUid} />
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select
                value={removeRole}
                onValueChange={(v) => setRemoveRole(v as AppRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">
              Remove
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asign Mwenyekiti wa Kamati</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onAssignCommittee(e)} className="grid gap-3">
            <div className="grid gap-2">
              <Label>User</Label>
              <Select value={committeeUserId} onValueChange={setCommitteeUserId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {committeeHeadProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {displayName(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Committee</Label>
              <Select value={committeeId} onValueChange={setCommitteeId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {committees.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name ?? c.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">
              Save assignment
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assign Mwenyekiti wa Jumuiya</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onAssignJumuiya(e)} className="grid gap-3">
            <div className="grid gap-2">
              <Label>User</Label>
              <Select value={jumuiyaUserId} onValueChange={setJumuiyaUserId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {jumuiyaChairmanProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {displayName(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Jumuiya</Label>
              <Select value={householdId} onValueChange={setHouseholdId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {households.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name ?? h.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">
              Save assignment
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assign Mzee wa kanisa kwa Jumuiya</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onAssignElder(e)} className="grid gap-3">
            <div className="grid gap-2">
              <Label>Mzee wa kanisa</Label>
              <Select value={elderUserId} onValueChange={setElderUserId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {churchElderProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {displayName(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Jumuiya</Label>
              <Select value={elderHouseholdId} onValueChange={setElderHouseholdId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {households.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name ?? h.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">
              Save assignment
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
