"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ExcelJS from "exceljs";
import {
  getBatchServiceAttendance,
  saveBatchServiceAttendance,
  saveWeeklyOfferingBatch,
} from "@/lib/actions/weekly-offerings";
import {
  formatDateISO,
  OFFERING_BATCH_SLOT_FIRST_SERVICE,
  OFFERING_BATCH_SLOT_MIDWEEK,
  OFFERING_BATCH_SLOT_SECOND_SERVICE,
  offeringBatchSlotLabel,
  WEEKLY_OFFERING_ROW_LIMIT,
} from "@/lib/offering/weekly";
import { parseAmountInput } from "@/lib/format/currency-input";
import { ActionButton } from "@/components/ui/action-button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROWS = WEEKLY_OFFERING_ROW_LIMIT;

type ExcelCellLike =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | { text?: string; hyperlink?: string; result?: unknown; formula?: string; richText?: Array<{ text?: string }> };

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

function normHeader(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

type RowState = {
  offering_number: string;
  ahadi: string;
  jengo: string;
  maendeleo: string;
};

function emptyRows(): RowState[] {
  return Array.from({ length: ROWS }, () => ({
    offering_number: "",
    ahadi: "",
    jengo: "",
    maendeleo: "",
  }));
}

export function WeeklyOfferingGrid({ defaultWeekOf }: { defaultWeekOf?: string }) {
  const router = useRouter();
  const [weekOf, setWeekOf] = useState(() => defaultWeekOf ?? formatDateISO(new Date()));
  const [rows, setRows] = useState<RowState[]>(emptyRows);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [batchSlot, setBatchSlot] = useState(OFFERING_BATCH_SLOT_FIRST_SERVICE);
  const [serviceLeader, setServiceLeader] = useState("");
  const [preacher, setPreacher] = useState("");
  const [adultsAttendance, setAdultsAttendance] = useState("");
  const [childrenAttendance, setChildrenAttendance] = useState("");
  const [attendanceEditable, setAttendanceEditable] = useState(true);
  const [attendanceApproved, setAttendanceApproved] = useState(false);
  const [attendancePending, setAttendancePending] = useState(false);

  const showSundayAttendance =
    batchSlot === OFFERING_BATCH_SLOT_FIRST_SERVICE ||
    batchSlot === OFFERING_BATCH_SLOT_SECOND_SERVICE;

  useEffect(() => {
    if (!showSundayAttendance) {
      setServiceLeader("");
      setPreacher("");
      setAdultsAttendance("");
      setChildrenAttendance("");
      setAttendanceEditable(true);
      setAttendanceApproved(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const res = await getBatchServiceAttendance(weekOf, batchSlot);
      if (cancelled) return;
      if ("error" in res && res.error) return;
      if ("serviceLeader" in res) {
        setServiceLeader(res.serviceLeader ?? "");
        setPreacher(res.preacher ?? "");
        setAdultsAttendance(
          res.adultsAttendance != null ? String(res.adultsAttendance) : "",
        );
        setChildrenAttendance(
          res.childrenAttendance != null ? String(res.childrenAttendance) : "",
        );
        setAttendanceEditable(res.editable !== false);
        setAttendanceApproved(res.approved === true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [weekOf, batchSlot, showSundayAttendance]);

  function attendancePayload() {
    return {
      serviceLeader: serviceLeader.trim() || null,
      preacher: preacher.trim() || null,
      adultsAttendance: adultsAttendance.trim() === "" ? null : Number(adultsAttendance),
      childrenAttendance: childrenAttendance.trim() === "" ? null : Number(childrenAttendance),
    };
  }

  async function onSaveAttendanceOnly() {
    if (attendancePending || !showSundayAttendance) return;
    setMsg(null);
    setErr(null);
    setAttendancePending(true);
    try {
      const res = await saveBatchServiceAttendance(weekOf, batchSlot, attendancePayload());
      if ("error" in res && res.error) {
        setErr(res.error);
        return;
      }
      setMsg("Taarifa za ibada zimehifadhiwa.");
      router.refresh();
    } finally {
      setAttendancePending(false);
    }
  }

  function updateRow(i: number, patch: Partial<RowState>) {
    setRows((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  async function onSave() {
    if (pending) return;
    setMsg(null);
    setErr(null);
    setPending(true);
    try {
      const payload = rows.map((r) => ({
        offering_number: r.offering_number.trim(),
        ahadi: parseAmountInput(r.ahadi),
        jengo: parseAmountInput(r.jengo),
        maendeleo: parseAmountInput(r.maendeleo),
      }));
      const res = await saveWeeklyOfferingBatch(weekOf, payload, batchSlot, attendancePayload());
      if ("error" in res && res.error) {
        setErr(res.error);
        return;
      }
      const parts = [
        `Saved ${res.inserted} offering line(s), affecting ${res.affectedRows ?? 0} member row(s).`,
        res.errors?.length ? `Notes: ${res.errors.join("; ")}` : null,
      ].filter(Boolean);
      setMsg(parts.join(" "));
      setRows(emptyRows());
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function importFromExcel(file: File | null) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setErr("Please upload an Excel .xlsx file.");
      return;
    }

    setErr(null);
    setMsg(null);

    const workbook = new ExcelJS.Workbook();
    const fileBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(fileBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      setErr("No worksheet found in the uploaded file.");
      return;
    }

    const OFFERING_HEADER_KEYS = [
      "offering",
      "offering number",
      "offering no",
      "offeringno",
      "member number",
      "card number",
      "envelope",
      "bahasha",
      "namba ya bahasha",
      "namba ya msharika",
      "namba ya mshirika",
      "namba",
      "msharika",
    ];
    const AHADI_KEYS = ["ahadi"];
    const JENGO_KEYS = ["jengo"];
    const DAYOSISI_KEYS = ["dayosisi", "maendeleo", "maendeleo ya dayosisi"];

    function rowHeaders(rowNumber: number): string[] {
      const row = sheet.getRow(rowNumber);
      const lastCol = Math.max(row.cellCount ?? 0, 30);
      const headers: string[] = [];
      for (let c = 1; c <= lastCol; c += 1) {
        const raw = row.getCell(c).value as ExcelCellLike;
        headers[c - 1] = normHeader(cellText(raw));
      }
      return headers;
    }

    function headerIdx(headers: string[], keys: string[]) {
      const normalizedKeys = keys.map((k) => normHeader(k));
      return headers.findIndex((h) => {
        if (!h) return false;
        return normalizedKeys.some((nk) => h === nk || h.includes(nk) || nk.includes(h));
      });
    }

    let headerRowNum = 1;
    let headers = rowHeaders(headerRowNum);
    let offeringIdx = headerIdx(headers, OFFERING_HEADER_KEYS);

    if (offeringIdx < 0) {
      for (let tryRow = 2; tryRow <= Math.min(10, sheet.rowCount); tryRow += 1) {
        headers = rowHeaders(tryRow);
        offeringIdx = headerIdx(headers, OFFERING_HEADER_KEYS);
        if (offeringIdx >= 0) {
          headerRowNum = tryRow;
          break;
        }
      }
    }

    if (offeringIdx < 0) {
      setErr(
        "Could not find an offering-number column. Use a header like \"Offering number\", \"Namba ya Bahasha\", or \"Card number\" in row 1–10.",
      );
      return;
    }

    const ahadiIdx = headerIdx(headers, AHADI_KEYS);
    const jengoIdx = headerIdx(headers, JENGO_KEYS);
    const dayosisiIdx = headerIdx(headers, DAYOSISI_KEYS);

    const imported: RowState[] = [];
    for (let i = headerRowNum + 1; i <= sheet.rowCount; i += 1) {
      const row = sheet.getRow(i);
      const read = (idx: number) =>
        idx >= 0 ? cellText(row.getCell(idx + 1).value as ExcelCellLike) : "";
      const offering_number = read(offeringIdx);
      if (!offering_number) continue;
      const toCell = (s: string) => {
        const n = parseAmountInput(s);
        return n === 0 ? "" : String(n);
      };
      imported.push({
        offering_number,
        ahadi: toCell(read(ahadiIdx)),
        jengo: toCell(read(jengoIdx)),
        maendeleo: toCell(read(dayosisiIdx)),
      });
      if (imported.length >= ROWS) break;
    }

    if (!imported.length) {
      setErr("No valid offering rows found.");
      return;
    }

    const nextRows = emptyRows();
    imported.forEach((row, idx) => {
      nextRows[idx] = row;
    });
    setRows(nextRows);
    setFileInputKey((k) => k + 1);
    setMsg(
      `Loaded ${imported.length} row(s) from Excel. Review and click Save weekly offerings.`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="week-of">Week</Label>
          <Input
            id="week-of"
            type="date"
            value={weekOf}
            onChange={(e) => setWeekOf(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="service-batch">Service / period (batch)</Label>
          <select
            id="service-batch"
            value={batchSlot}
            onChange={(e) => setBatchSlot(Number(e.target.value))}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value={OFFERING_BATCH_SLOT_FIRST_SERVICE}>
              {offeringBatchSlotLabel(OFFERING_BATCH_SLOT_FIRST_SERVICE)}
            </option>
            <option value={OFFERING_BATCH_SLOT_SECOND_SERVICE}>
              {offeringBatchSlotLabel(OFFERING_BATCH_SLOT_SECOND_SERVICE)}
            </option>
            <option value={OFFERING_BATCH_SLOT_MIDWEEK}>
              {offeringBatchSlotLabel(OFFERING_BATCH_SLOT_MIDWEEK)}
            </option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 lg:col-span-1">
          <Input
            key={fileInputKey}
            type="file"
            accept=".xlsx"
            onChange={(e) => void importFromExcel(e.target.files?.[0] ?? null)}
            className="max-w-[280px]"
          />
        </div>
      </div>

      {showSundayAttendance ? (
        <div className="rounded-md border border-border bg-muted/20 p-4">
          <p className="mb-3 text-sm font-medium">Taarifa za Ibada</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="service-leader">Kiongozi wa Ibada</Label>
              <Input
                id="service-leader"
                type="text"
                value={serviceLeader}
                onChange={(e) => setServiceLeader(e.target.value)}
                disabled={!attendanceEditable}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="preacher">Mhubiri</Label>
              <Input
                id="preacher"
                type="text"
                value={preacher}
                onChange={(e) => setPreacher(e.target.value)}
                disabled={!attendanceEditable}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adults-attendance">Mahudhurio watu wazima</Label>
              <Input
                id="adults-attendance"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={adultsAttendance}
                onChange={(e) => setAdultsAttendance(e.target.value)}
                placeholder="0"
                disabled={!attendanceEditable}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="children-attendance">Mahudhurio watoto</Label>
              <Input
                id="children-attendance"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={childrenAttendance}
                onChange={(e) => setChildrenAttendance(e.target.value)}
                placeholder="0"
                disabled={!attendanceEditable}
              />
            </div>
            {attendanceEditable && !attendanceApproved ? (
              <div className="flex items-end sm:col-span-2 lg:col-span-4">
                <ActionButton
                  type="button"
                  variant="outline"
                  onClick={() => void onSaveAttendanceOnly()}
                  loading={attendancePending}
                  loadingText="Saving…"
                >
                  Hifadhi taarifa za ibada
                </ActionButton>
              </div>
            ) : null}
          </div>
          {attendanceApproved ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Batch hii imeidhinishwa — taarifa za ibada haziwezi kubadilishwa.
            </p>
          ) : !attendanceEditable ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Batch hii imewekwa idhini — taarifa za ibada haziwezi kubadilishwa.
            </p>
          ) : null}
        </div>
      ) : null}

      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      <div className="max-h-[min(70vh,720px)] overflow-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Offering No.</TableHead>
              <TableHead>Ahadi (TZS)</TableHead>
              <TableHead>Jengo (TZS)</TableHead>
              <TableHead>Dayosisi (TZS)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <Input
                    className="min-w-[100px]"
                    value={r.offering_number}
                    onChange={(e) => updateRow(i, { offering_number: e.target.value })}
                    placeholder="Card #"
                  />
                </TableCell>
                <TableCell>
                  <CurrencyInput
                    value={r.ahadi}
                    onValueChange={(v) => updateRow(i, { ahadi: v })}
                  />
                </TableCell>
                <TableCell>
                  <CurrencyInput
                    value={r.jengo}
                    onValueChange={(v) => updateRow(i, { jengo: v })}
                  />
                </TableCell>
                <TableCell>
                  <CurrencyInput
                    value={r.maendeleo}
                    onValueChange={(v) => updateRow(i, { maendeleo: v })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end border-t pt-4">
        <ActionButton
          type="button"
          size="lg"
          onClick={() => void onSave()}
          loading={pending}
          loadingText="Saving…"
        >
          Save / Hifadhi
        </ActionButton>
      </div>
    </div>
  );
}
