export function getReportRange(sp: Record<string, string | undefined>): {
  label: string;
  start: Date;
  end: Date;
} {
  const now = new Date();
  const y = Number(sp.year) || now.getFullYear();
  const range = sp.range || "annual";

  if (range === "annual") {
    return {
      label: `Year ${y}`,
      start: new Date(y, 0, 1),
      end: new Date(y, 11, 31, 23, 59, 59, 999),
    };
  }
  if (range === "quarterly") {
    const q = Math.min(4, Math.max(1, Number(sp.quarter) || 1));
    const sm = (q - 1) * 3;
    return {
      label: `Q${q} ${y}`,
      start: new Date(y, sm, 1),
      end: new Date(y, sm + 3, 0, 23, 59, 59, 999),
    };
  }
  if (range === "semi_annual") {
    const half = Math.min(2, Math.max(1, Number(sp.half) || 1));
    const startMonth = half === 1 ? 0 : 6;
    const endMonth = half === 1 ? 5 : 11;
    return {
      label: `H${half} ${y}`,
      start: new Date(y, startMonth, 1),
      end: new Date(y, endMonth + 1, 0, 23, 59, 59, 999),
    };
  }
  if (range === "monthly") {
    const m = Math.min(12, Math.max(1, Number(sp.month) || now.getMonth() + 1));
    return {
      label: `${new Date(y, m - 1).toLocaleString(undefined, { month: "long" })} ${y}`,
      start: new Date(y, m - 1, 1),
      end: new Date(y, m, 0, 23, 59, 59, 999),
    };
  }
  if (range === "other") {
    const start = sp.start ? new Date(`${sp.start}T00:00:00`) : new Date(y, 0, 1);
    const end = sp.end ? new Date(`${sp.end}T23:59:59.999`) : new Date(y, 11, 31, 23, 59, 59, 999);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return {
        label: `Year ${y}`,
        start: new Date(y, 0, 1),
        end: new Date(y, 11, 31, 23, 59, 59, 999),
      };
    }
    return {
      label: `Other ${sp.start ?? start.toISOString().slice(0, 10)} → ${
        sp.end ?? end.toISOString().slice(0, 10)
      }`,
      start,
      end,
    };
  }

  const weekNo = Math.min(54, Math.max(1, Number(sp.weekNo) || 1));
  const jan4 = new Date(y, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - jan4Day + 1);
  firstMonday.setHours(0, 0, 0, 0);
  const ws = new Date(firstMonday);
  ws.setDate(firstMonday.getDate() + (weekNo - 1) * 7);
  const we = new Date(ws);
  we.setDate(ws.getDate() + 6);
  we.setHours(23, 59, 59, 999);
  return {
    label: `W${weekNo} ${y} (${ws.toISOString().slice(0, 10)} → ${we.toISOString().slice(0, 10)})`,
    start: ws,
    end: we,
  };
}
