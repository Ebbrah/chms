"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  assignDioceseOfficer,
  assignDistrictOfficer,
  removeDioceseOfficer,
  removeDistrictOfficer,
} from "@/lib/actions/regional-officers";
import {
  DIOCESE_ROLE_LABELS,
  DISTRICT_ROLE_LABELS,
  type DioceseOfficerRole,
  type DistrictOfficerRole,
} from "@/lib/auth/regional-roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

type DioceseOfficerRow = {
  id: string;
  role: DioceseOfficerRole;
  profiles: { full_name: string | null; email: string | null } | null;
  dioceses: { name: string } | null;
};

type DistrictOfficerRow = {
  id: string;
  role: DistrictOfficerRole;
  profiles: { full_name: string | null; email: string | null } | null;
  districts: { name: string } | null;
};

type SectionState = {
  loading: boolean;
  message: string | null;
  error: string | null;
};

const initialSectionState = (): SectionState => ({
  loading: false,
  message: null,
  error: null,
});

export function OfficersManagement({
  dioceses,
  districts,
  dioceseOfficers,
  districtOfficers,
}: {
  dioceses: { id: string; name: string }[];
  districts: { id: string; name: string; diocese_id: string }[];
  dioceseOfficers: DioceseOfficerRow[];
  districtOfficers: DistrictOfficerRow[];
}) {
  const router = useRouter();
  const [dioceseState, setDioceseState] = useState<SectionState>(initialSectionState);
  const [districtState, setDistrictState] = useState<SectionState>(initialSectionState);
  const [dioceseId, setDioceseId] = useState(dioceses[0]?.id ?? "");
  const [dioceseRole, setDioceseRole] = useState<DioceseOfficerRole | "">("");
  const [districtId, setDistrictId] = useState(districts[0]?.id ?? "");
  const [districtRole, setDistrictRole] = useState<DistrictOfficerRole | "">("");

  async function handleAssignDiocese(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dioceseId || !dioceseRole) return;
    setDioceseState({ loading: true, message: null, error: null });
    const fd = new FormData(e.currentTarget);
    fd.set("diocese_id", dioceseId);
    fd.set("role", dioceseRole);
    const res = await assignDioceseOfficer(fd);
    if ("error" in res && res.error) {
      setDioceseState({ loading: false, message: null, error: res.error });
      return;
    }
    setDioceseState({
      loading: false,
      message: "Dayosisi officer assigned.",
      error: null,
    });
    e.currentTarget.reset();
    setDioceseRole("");
    router.refresh();
  }

  async function handleAssignDistrict(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!districtId || !districtRole) return;
    setDistrictState({ loading: true, message: null, error: null });
    const fd = new FormData(e.currentTarget);
    fd.set("district_id", districtId);
    fd.set("role", districtRole);
    const res = await assignDistrictOfficer(fd);
    if ("error" in res && res.error) {
      setDistrictState({ loading: false, message: null, error: res.error });
      return;
    }
    setDistrictState({
      loading: false,
      message: "Jimbo officer assigned.",
      error: null,
    });
    e.currentTarget.reset();
    setDistrictRole("");
    router.refresh();
  }

  async function handleRemoveDiocese(id: string) {
    setDioceseState({ loading: true, message: null, error: null });
    const res = await removeDioceseOfficer(id);
    if ("error" in res && res.error) {
      setDioceseState({ loading: false, message: null, error: res.error });
      return;
    }
    setDioceseState({ loading: false, message: null, error: null });
    router.refresh();
  }

  async function handleRemoveDistrict(id: string) {
    setDistrictState({ loading: true, message: null, error: null });
    const res = await removeDistrictOfficer(id);
    if ("error" in res && res.error) {
      setDistrictState({ loading: false, message: null, error: res.error });
      return;
    }
    setDistrictState({ loading: false, message: null, error: null });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Assign dayosisi officer</h2>
        {dioceseState.error ? (
          <Alert variant="destructive">
            <AlertDescription>{dioceseState.error}</AlertDescription>
          </Alert>
        ) : null}
        {dioceseState.message ? (
          <Alert>
            <AlertDescription>{dioceseState.message}</AlertDescription>
          </Alert>
        ) : null}
        <form
          onSubmit={(e) => void handleAssignDiocese(e)}
          className="grid max-w-xl gap-4 sm:grid-cols-2"
        >
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="diocese_id">Dayosisi</Label>
            <Select value={dioceseId} onValueChange={setDioceseId}>
              <SelectTrigger id="diocese_id">
                <SelectValue placeholder="Select dayosisi" />
              </SelectTrigger>
              <SelectContent>
                {dioceses.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="diocese-email">User email</Label>
            <Input id="diocese-email" name="email" type="email" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="diocese-role">Role</Label>
            <Select
              value={dioceseRole}
              onValueChange={(v) => setDioceseRole(v as DioceseOfficerRole)}
            >
              <SelectTrigger id="diocese-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DIOCESE_ROLE_LABELS) as DioceseOfficerRole[]).map((role) => (
                  <SelectItem key={role} value={role}>
                    {DIOCESE_ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={dioceseState.loading || !dioceseRole}
            className="sm:col-span-2"
          >
            {dioceseState.loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Assign dayosisi officer"
            )}
          </Button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Assign jimbo officer</h2>
        {districtState.error ? (
          <Alert variant="destructive">
            <AlertDescription>{districtState.error}</AlertDescription>
          </Alert>
        ) : null}
        {districtState.message ? (
          <Alert>
            <AlertDescription>{districtState.message}</AlertDescription>
          </Alert>
        ) : null}
        <form
          onSubmit={(e) => void handleAssignDistrict(e)}
          className="grid max-w-xl gap-4 sm:grid-cols-2"
        >
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="district_id">Jimbo</Label>
            <Select value={districtId} onValueChange={setDistrictId}>
              <SelectTrigger id="district_id">
                <SelectValue placeholder="Select jimbo" />
              </SelectTrigger>
              <SelectContent>
                {districts.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="district-email">User email</Label>
            <Input id="district-email" name="email" type="email" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="district-role">Role</Label>
            <Select
              value={districtRole}
              onValueChange={(v) => setDistrictRole(v as DistrictOfficerRole)}
            >
              <SelectTrigger id="district-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DISTRICT_ROLE_LABELS) as DistrictOfficerRole[]).map((role) => (
                  <SelectItem key={role} value={role}>
                    {DISTRICT_ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={districtState.loading || !districtRole}
            className="sm:col-span-2"
          >
            {districtState.loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Assign jimbo officer"
            )}
          </Button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Current dayosisi officers</h2>
        <OfficerTable
          rows={dioceseOfficers.map((o) => ({
            id: o.id,
            scope: o.dioceses?.name ?? "—",
            name: o.profiles?.full_name ?? "—",
            email: o.profiles?.email ?? "—",
            role: DIOCESE_ROLE_LABELS[o.role as DioceseOfficerRole] ?? o.role,
          }))}
          onRemove={(id) => void handleRemoveDiocese(id)}
          loading={dioceseState.loading}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Current jimbo officers</h2>
        <OfficerTable
          rows={districtOfficers.map((o) => ({
            id: o.id,
            scope: o.districts?.name ?? "—",
            name: o.profiles?.full_name ?? "—",
            email: o.profiles?.email ?? "—",
            role: DISTRICT_ROLE_LABELS[o.role as DistrictOfficerRole] ?? o.role,
          }))}
          onRemove={(id) => void handleRemoveDistrict(id)}
          loading={districtState.loading}
        />
      </section>
    </div>
  );
}

function OfficerTable({
  rows,
  onRemove,
  loading,
}: {
  rows: { id: string; scope: string; name: string; email: string; role: string }[];
  onRemove: (id: string) => void;
  loading: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Scope</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-muted-foreground">
              No officers assigned yet.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.scope}</TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.email}</TableCell>
              <TableCell>{row.role}</TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={loading}
                  onClick={() => onRemove(row.id)}
                >
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
