"use client";

import { Button } from "@/components/ui/button";

type ExportCsvButtonProps = {
  filename: string;
  headers: string[];
  rows: string[][];
  label?: string;
};

/** Client-side CSV download for aggregate regional tables (no member PII export). */
export function ExportCsvButton({
  filename,
  headers,
  rows,
  label = "Export CSV",
}: ExportCsvButtonProps) {
  function download() {
    const escape = (value: string) => {
      const cell = String(value ?? "");
      if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
      return cell;
    };

    const lines = [
      headers.map(escape).join(","),
      ...rows.map((row) => row.map(escape).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={download} disabled={rows.length === 0}>
      {label}
    </Button>
  );
}
