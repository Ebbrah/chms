import Link from "next/link";
import type { ReactNode } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmountTZS } from "@/lib/format/amount";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadChairProfileForHousehold, loadEldersForHousehold } from "@/lib/members/household-leaders";

type Details = Record<string, unknown>;

function readValue(details: Details, key: string, fallback = "—") {
  const value = details[key];
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function computeAge(dateText: string) {
  const birthDate = new Date(dateText);
  if (Number.isNaN(birthDate.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return age >= 0 ? String(age) : "—";
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="bg-purple-100/80 dark:bg-purple-900/30">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 pt-6">{children}</CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{value || "—"}</p>
    </div>
  );
}

function formatPledge(details: Details, key: string) {
  const raw = readValue(details, key, "");
  if (!raw || raw === "—") return "—";
  const n = Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return raw;
  return formatAmountTZS(n);
}

export async function MemberProfileReport({
  profileId,
  canEdit = false,
  backHref = "/dashboard",
}: {
  profileId: string;
  canEdit?: boolean;
  backHref?: string;
}) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", profileId)
    .single();
  if (!profile) return null;

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", profileId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const details =
    member?.member_details && typeof member.member_details === "object"
      ? (member.member_details as Details)
      : {};

  const { data: household } = member?.household_id
    ? await supabase
        .from("households")
        .select("name, chairperson_user_id")
        .eq("id", String(member.household_id))
        .maybeSingle()
    : { data: null };
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role, user_id")
    .eq("role", "pastor");
  const roleIds = Array.from(new Set((roleRows ?? []).map((r) => String(r.user_id ?? "")).filter(Boolean)));
  const { data: roleProfiles } = roleIds.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", roleIds)
    : { data: [] };
  const roleById = new Map((roleProfiles ?? []).map((p) => [String(p.id), p]));
  const pastorId = (roleRows ?? []).find((r) => r.role === "pastor")?.user_id ?? null;
  const pastor = pastorId ? roleById.get(String(pastorId)) : null;
  const elders = await loadEldersForHousehold(supabase, member?.household_id ?? null);
  const chair = await loadChairProfileForHousehold(supabase, member?.household_id ?? null);

  const ministries = Array.isArray(details.ministries)
    ? details.ministries.map((m) => String(m)).filter(Boolean)
    : [];

  const children = Array.isArray(details.children)
    ? details.children
        .map((row) => ({
          full_name: String((row as Details).full_name ?? "").trim(),
          birth_date: String((row as Details).birth_date ?? "").trim(),
          relationship: String((row as Details).relationship ?? "").trim(),
        }))
        .filter((row) => row.full_name || row.birth_date || row.relationship)
    : [];

  const jumuiyaName = readValue(details, "jumuiya_name", household?.name ?? "");
  const currentYear = new Date().getFullYear();
  const passportPhoto = readValue(details, "passport_photo_url", "");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Member details</h1>
        <div className="flex gap-2">
          {canEdit ? (
            <Button variant="outline" asChild>
              <Link href={`/dashboard/members/${profileId}`}>Edit</Link>
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link href={backHref}>Back</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[120px_1fr_220px] md:items-start">
        <div className="flex justify-center md:justify-start">
          {passportPhoto && passportPhoto !== "—" ? (
            <Image
              src={passportPhoto}
              alt="Passport photo"
              width={96}
              height={120}
              className="h-[120px] w-24 rounded border object-cover"
            />
          ) : (
            <div className="flex h-[120px] w-24 items-center justify-center rounded border bg-muted/40 text-xs text-muted-foreground">
              No photo
            </div>
          )}
        </div>

        <div className="text-center leading-relaxed">
          <p>K.K.K.T Dayosisi ya Dodoma</p>
          <p className="text-lg font-bold uppercase">USHARIKA WA EBENEZER ILAZO</p>
          <p className="mt-8 italic">Fomu ya Msharika Mwaka {currentYear}</p>
        </div>

        <div className="text-center md:text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Offering Number</p>
          <p className="text-3xl font-extrabold tracking-wide">
            {String(member?.offering_number ?? "—")}
          </p>
        </div>
      </div>

      <Group title="A: TAARIFA BINAFSI">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Jina la msharika" value={readValue(details, "full_name", profile.full_name ?? "—")} />
          <Field label="Tarehe ya kuzaliwa" value={readValue(details, "birth_date")} />
          <Field label="Jinsia" value={readValue(details, "gender")} />
          <Field label="Hali ya ndoa" value={readValue(details, "marital_status")} />
          <Field label="Jina la Mwenzi (Mume/Mke)" value={readValue(details, "spouse_name")} />
          <Field label="Aina ya Ndoa" value={readValue(details, "marriage_type")} />
          <Field label="Tarehe ya Ndoa" value={readValue(details, "marriage_date")} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Majina ya watoto
          </p>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jina</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Uhusiano</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {children.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Hakuna taarifa za watoto.
                    </TableCell>
                  </TableRow>
                ) : (
                  children.map((row, idx) => (
                    <TableRow key={`child-${idx}`}>
                      <TableCell>{row.full_name || "—"}</TableCell>
                      <TableCell>{computeAge(row.birth_date)}</TableCell>
                      <TableCell>{row.relationship || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Group>

      <Group title="B: Mawasiliano ya Makazi">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Namba ya Simu (yako)" value={String(member?.phone ?? "—")} />
          <Field label="Namba ya Simu (mwenza)" value={readValue(details, "spouse_phone")} />
          <Field label="Sanduku la Barua" value={readValue(details, "postal_address")} />
          <Field label="Barua Pepe" value={String(member?.email ?? profile.email ?? "—")} />
          <Field label="Mtaa" value={String(member?.address ?? "—")} />
        </div>
      </Group>

      <Group title="C: Elimu na Kazi">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Kazi/Shughuli" value={readValue(details, "occupation")} />
          <Field label="Elimu" value={readValue(details, "education_level")} />
          <Field label="Ujuzi" value={readValue(details, "profession")} />
          <Field label="Mahali pa Kazi" value={readValue(details, "work_place")} />
        </div>
      </Group>

      <Group title="D: Huduma za Kiroho">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Umebatizwa?" value={readValue(details, "is_baptized")} />
          <Field label="Kipaimara" value={readValue(details, "has_confirmation")} />
          <Field
            label="Unashiriki Sakramenti ya meza ya Bwana?"
            value={readValue(details, "takes_holy_communion")}
          />
        </div>
      </Group>

      <Group title="E: Ushiriki wa Huduma za Kanisa">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Unashiriki Jumuiya?" value={readValue(details, "participates_in_jumuiya")} />
          <Field label="Jina la Jumuiya" value={jumuiyaName || "—"} />
          <Field label="Mwenyekiti wa Jumuiya" value={readValue(details, "jumuiya_chairperson")} />
          <Field label="Mzee wa kanisa 1" value={String(elders[0]?.full_name ?? "—")} />
          <Field label="Mzee wa kanisa 2" value={String(elders[1]?.full_name ?? "—")} />
          <Field
            label="Huduma unazoshiriki"
            value={ministries.length > 0 ? ministries.join(", ") : "—"}
          />
        </div>
      </Group>

      <Group title={`F: Ahadi zako kwa Bwana ${currentYear}`}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Ahadi" value={formatPledge(details, "pledge_1")} />
          <Field label="Ujenzi/Maendeleo ya Usharika" value={formatPledge(details, "pledge_2")} />
          <Field label="Maendeleo ya Dayosisi" value={formatPledge(details, "pledge_3")} />
        </div>
      </Group>
    </div>
  );
}
