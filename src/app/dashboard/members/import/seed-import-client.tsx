"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ExcelJS from "exceljs";
import { upsertMemberSeeds, type MemberSeedInput } from "@/lib/actions/member-seeds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatAmountTZS } from "@/lib/format/amount";

const MAX_SEED_IMPORT_ROWS = 1000;

type ExcelCellLike =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | { text?: string; hyperlink?: string; result?: unknown; formula?: string; richText?: Array<{ text?: string }> };

function text(v: unknown) {
  return String(v ?? "").trim();
}

function cellText(v: ExcelCellLike) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v).trim();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (Array.isArray(v.richText) && v.richText.length) {
      return v.richText.map((r) => r.text ?? "").join("").trim();
    }
    if (typeof v.text === "string" && v.text.trim()) return v.text.trim();
    if (v.result !== undefined && v.result !== null) return String(v.result).trim();
    if (typeof v.hyperlink === "string" && v.hyperlink.trim()) return v.hyperlink.trim();
  }
  return String(v).trim();
}

function num(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtPledge(v: number | null | undefined) {
  return v == null ? "—" : formatAmountTZS(v);
}

function normHeader(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function dedupeRows(inputs: MemberSeedInput[]) {
  const byOfferingNumber = new Map<string, MemberSeedInput>();
  let duplicateCount = 0;

  for (const row of inputs) {
    const offeringNumber = text(row.offering_number);
    if (!offeringNumber) continue;

    if (byOfferingNumber.has(offeringNumber)) duplicateCount += 1;

    byOfferingNumber.set(offeringNumber, {
      ...row,
      offering_number: offeringNumber,
      full_name: text(row.full_name) || offeringNumber,
    });
  }

  return {
    rows: Array.from(byOfferingNumber.values()),
    duplicateCount,
  };
}

export function MemberSeedImportClient() {
  const router = useRouter();
  const [rows, setRows] = useState<MemberSeedInput[]>([]);
  const [preview, setPreview] = useState<MemberSeedInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const canUpload = useMemo(() => rows.length > 0 && !loading, [rows.length, loading]);

  async function parseXlsx(f: File) {
    setError(null);
    setMessage(null);
    setPreview([]);
    const wb = new ExcelJS.Workbook();
    const buf = await f.arrayBuffer();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error("No worksheet found");

    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, col) => {
      headers[col - 1] = normHeader(cellText(cell.value as ExcelCellLike));
    });

    const idx = (names: string[]) =>
      headers.findIndex((h) => names.some((n) => h.includes(normHeader(n))));

    const firstIdx = idx(["first", "first name", "firstname"]);
    const middleIdx = idx(["middle", "middle name", "middlename"]);
    const lastIdx = idx(["last", "last name", "surname"]);
    const genderIdx = idx(["gender", "sex", "jinsia"]);
    const phoneIdx = idx(["phone", "phone number", "mobile", "tel", "simu"]);
    const offeringIdx = idx(["offering", "offering number", "member number"]);
    const ahadiIdx = idx(["ahadi", "pledge ahadi"]);
    const jengoIdx = idx(["jengo", "pledge jengo"]);
    const dayosisiIdx = idx(["dayosisi", "pledge dayosisi"]);

    if (offeringIdx < 0) throw new Error("Could not find Offering Number column");

    const rows: MemberSeedInput[] = [];
    let truncated = false;
    for (let r = 2; r <= ws.rowCount; r += 1) {
      const row = ws.getRow(r);
      const cell = (i: number) => (i >= 0 ? (row.getCell(i + 1).value as ExcelCellLike) : null);
      const offering_number = cellText(cell(offeringIdx));
      if (!offering_number) continue;

      const parts = [cellText(cell(firstIdx)), cellText(cell(middleIdx)), cellText(cell(lastIdx))].filter(Boolean);
      const full_name = parts.join(" ").trim() || cellText(cell(lastIdx)) || offering_number;

      rows.push({
        offering_number,
        full_name,
        gender: cellText(cell(genderIdx)) || null,
        phone: cellText(cell(phoneIdx)) || null,
        pledge_ahadi: num(cellText(cell(ahadiIdx))),
        pledge_jengo: num(cellText(cell(jengoIdx))),
        pledge_dayosisi: num(cellText(cell(dayosisiIdx))),
        raw: {
          first_name: cellText(cell(firstIdx)) || null,
          middle_name: cellText(cell(middleIdx)) || null,
          last_name: cellText(cell(lastIdx)) || null,
        },
      });
      if (rows.length >= MAX_SEED_IMPORT_ROWS) {
        truncated = true;
        break;
      }
    }
    const { rows: dedupedRows, duplicateCount } = dedupeRows(rows);
    setPreview(dedupedRows.slice(0, 25));
    const truncationNote = truncated
      ? ` File has more rows; only first ${MAX_SEED_IMPORT_ROWS} non-empty offering number row(s) were imported.`
      : "";
    setMessage(
      duplicateCount
        ? `Parsed ${rows.length} row(s). Ignored ${duplicateCount} duplicate offering number row(s); the last row wins. Preview shows first 25 unique rows.${truncationNote}`
        : `Parsed ${dedupedRows.length} row(s). Preview shows first 25.${truncationNote}`,
    );
    return dedupedRows;
  }

  async function onChoose(f: File | null) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      setError("Please upload an Excel .xlsx file.");
      setRows([]);
      setPreview([]);
      return;
    }
    try {
      const all = await parseXlsx(f);
      setRows(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse file");
    }
  }

  async function onUpload() {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await upsertMemberSeeds(rows, { replaceExisting });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setMessage(
        res.duplicateCount
          ? `Uploaded ${res.count} unique row(s). Ignored ${res.duplicateCount} duplicate offering number row(s); the last row wins.`
          : `Uploaded ${res.count} row(s) to seed storage.${replaceExisting ? " Previous seed rows were replaced." : ""} Open 'Uploaded but not registered' to verify.`,
      );
      // Reset uploader state after successful upload so the next import starts fresh.
      setRows([]);
      setPreview([]);
      setFileInputKey((prev) => prev + 1);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertTitle>Import</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          key={fileInputKey}
          type="file"
          accept=".xlsx"
          onChange={(e) => void onChoose(e.target.files?.[0] ?? null)}
        />
        <Button type="button" disabled={!canUpload} onClick={() => void onUpload()}>
          {loading ? "Uploading…" : "Upload seeds"}
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={replaceExisting}
          onChange={(e) => setReplaceExisting(e.target.checked)}
          disabled={loading}
        />
        Replace existing seed rows for this church before upload
      </label>

      {preview.length ? (
        <div className="rounded-md border border-border p-3 text-sm">
          <div className="mb-2 font-medium">Preview</div>
          <ul className="space-y-1 text-muted-foreground">
            {preview.map((r) => (
              <li key={r.offering_number}>
                {r.offering_number} — {r.full_name} — Ahadi {fmtPledge(r.pledge_ahadi)}, Jengo{" "}
                {fmtPledge(r.pledge_jengo)}, Dayosisi {fmtPledge(r.pledge_dayosisi)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

