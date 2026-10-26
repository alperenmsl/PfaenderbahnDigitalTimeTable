import ExcelJS from "exceljs";
import {
  MONTHS, WEEKDAYS_SHORT, TimeEntry, daysInMonth, emptyEntry, entryMinutes,
  isoDate, summarize, toMin, weekdayOf,
} from "./time";

export type PersonMonth = { name: string; entries: TimeEntry[]; submitted: boolean };

/** Anzeigename aus einer profiles-Zeile – bei Bedarf an deine Spalten anpassen */
export function profileName(p: Record<string, any>): string {
  return (
    p.full_name ?? p.name ??
    ([p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unbekannt")
  );
}

const BLUE = "FF1456F0";
const GREY = "FFF1F5F9";
const HEADERS = [
  "Datum", "Tag", "Von", "Bis", "Von", "Bis", "Von", "Bis",
  "Stunden (h:mm)", "Stunden (dez.)", "Essen", "Notiz",
];
const WIDTHS = [12, 6, 8, 8, 8, 8, 8, 8, 15, 15, 8, 40];

function fillSheet(ws: ExcelJS.Worksheet, name: string, year: number, m0: number, entries: TimeEntry[]) {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  ws.columns = WIDTHS.map((width) => ({ width }));

  ws.mergeCells("A1:L1");
  ws.getCell("A1").value = `Zeiterfassung – ${name}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.mergeCells("A2:L2");
  ws.getCell("A2").value = `${MONTHS[m0]} ${year}`;
  ws.getCell("A2").font = { color: { argb: "FF64748B" } };

  const head = ws.getRow(4);
  head.values = HEADERS;
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  });
  head.height = 22;

  const first = 5;
  const n = daysInMonth(year, m0);
  const time = (s: string) => (s ? toMin(s) / 1440 : null);

  for (let d = 1; d <= n; d++) {
    const iso = isoDate(year, m0, d);
    const e = byDate.get(iso) ?? emptyEntry(iso);
    const wd = weekdayOf(iso);
    const min = entryMinutes(e);
    const row = ws.getRow(first + d - 1);
    row.values = [
      new Date(year, m0, d), WEEKDAYS_SHORT[wd],
      time(e.t1_from), time(e.t1_to), time(e.t2_from), time(e.t2_to), time(e.t3_from), time(e.t3_to),
      min ? min / 1440 : null, min ? min / 60 : null,
      e.meal ? 1 : null, e.note || null,
    ];
    row.getCell(1).numFmt = "DD.MM.YYYY";
    for (let c = 3; c <= 8; c++) row.getCell(c).numFmt = "hh:mm";
    row.getCell(9).numFmt = "[h]:mm";
    row.getCell(10).numFmt = "0.00";
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.alignment = { horizontal: col === 12 ? "left" : "center", vertical: "middle", wrapText: col === 12 };
      if (wd === 0 || wd === 6) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY } };
    });
  }

  const s = summarize([...byDate.values()].filter((e) => e.date.startsWith(`${year}-${String(m0 + 1).padStart(2, "0")}`)));
  const last = first + n - 1;
  const tot = ws.getRow(last + 1);
  tot.getCell(1).value = "Summe";
  tot.getCell(9).value = { formula: `SUM(I${first}:I${last})`, result: s.minutes / 1440 };
  tot.getCell(9).numFmt = "[h]:mm";
  tot.getCell(10).value = { formula: `SUM(J${first}:J${last})`, result: s.minutes / 60 };
  tot.getCell(10).numFmt = "0.00";
  tot.getCell(11).value = { formula: `SUM(K${first}:K${last})`, result: s.meals };
  tot.eachCell({ includeEmpty: true }, (c, col) => {
    if (col > 12) return;
    c.font = { bold: true };
    c.alignment = { horizontal: "center" };
    c.border = { top: { style: "medium", color: { argb: BLUE } } };
  });
  tot.getCell(1).alignment = { horizontal: "left" };

  ws.views = [{ state: "frozen", ySplit: 4 }];
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

async function download(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const safe = (s: string) => s.replace(/[^\p{L}\p{N}_-]+/gu, "_");
const mm = (m0: number) => String(m0 + 1).padStart(2, "0");

/** Eine Person, ein Monat */
export async function exportPerson(name: string, year: number, m0: number, entries: TimeEntry[]) {
  const wb = new ExcelJS.Workbook();
  fillSheet(wb.addWorksheet("Zeiterfassung"), name, year, m0, entries);
  await download(wb, `Zeiterfassung_${safe(name)}_${year}-${mm(m0)}.xlsx`);
}

/** Alle Personen, ein Monat: Übersicht + je ein Blatt pro Person */
export async function exportAll(year: number, m0: number, people: PersonMonth[]) {
  const wb = new ExcelJS.Workbook();

  const ov = wb.addWorksheet("Übersicht");
  ov.columns = [{ width: 28 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 10 }, { width: 14 }];
  ov.mergeCells("A1:F1");
  ov.getCell("A1").value = `Zeiterfassung ${MONTHS[m0]} ${year}`;
  ov.getCell("A1").font = { bold: true, size: 14 };
  const head = ov.getRow(3);
  head.values = ["Mitarbeiter", "Arbeitstage", "Stunden (h:mm)", "Stunden (dez.)", "Essen", "Status"];
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    c.alignment = { horizontal: "center" };
  });

  const used = new Set<string>(["übersicht"]);
  people.forEach((p, i) => {
    const s = summarize(p.entries);
    const r = ov.getRow(4 + i);
    r.values = [p.name, s.days, s.minutes / 1440, s.minutes / 60, s.meals, p.submitted ? "abgegeben" : "offen"];
    r.getCell(3).numFmt = "[h]:mm";
    r.getCell(4).numFmt = "0.00";
    r.eachCell((c, col) => { if (col > 1) c.alignment = { horizontal: "center" }; });

    let sheet = p.name.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || `Person ${i + 1}`;
    while (used.has(sheet.toLowerCase())) sheet = `${sheet.slice(0, 28)} ${i + 1}`;
    used.add(sheet.toLowerCase());
    fillSheet(wb.addWorksheet(sheet), p.name, year, m0, p.entries);
  });

  await download(wb, `Zeiterfassung_Alle_${year}-${mm(m0)}.xlsx`);
}