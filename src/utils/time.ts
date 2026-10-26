// Hilfsfunktionen für die Zeiterfassung

export type TimeKey = "t1_from" | "t1_to" | "t2_from" | "t2_to" | "t3_from" | "t3_to";

export const TIME_KEYS: TimeKey[] = ["t1_from", "t1_to", "t2_from", "t2_to", "t3_from", "t3_to"];

export type TimeEntry = {
  date: string; // yyyy-mm-dd
  t1_from: string; t1_to: string;
  t2_from: string; t2_to: string;
  t3_from: string; t3_to: string; // "" = leer, sonst "HH:MM"
  meal: boolean;
  note: string;
};

export const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
export const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const pad = (n: number) => String(n).padStart(2, "0");

export const isoDate = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
export const daysInMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();
export const weekdayOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};
export const fmtDateDE = (iso: string) => iso.split("-").reverse().join(".");

export const emptyEntry = (date: string): TimeEntry => ({
  date, t1_from: "", t1_to: "", t2_from: "", t2_to: "", t3_from: "", t3_to: "", meal: false, note: "",
});

export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Minuten als h:mm, z. B. 480 -> "8:00" */
export const fmtHM = (min: number) => `${Math.floor(min / 60)}:${pad(min % 60)}`;
/** Dezimalstunden mit Komma, z. B. 450 -> "7,50" */
export const fmtDec = (min: number) => (min / 60).toFixed(2).replace(".", ",");

export const blocksOf = (e: TimeEntry): [string, string][] => [
  [e.t1_from, e.t1_to],
  [e.t2_from, e.t2_to],
  [e.t3_from, e.t3_to],
];

/** Fehlertext oder null, wenn der Eintrag gespeichert werden darf */
export function entryIssue(e: TimeEntry): string | null {
  let lastEnd = -1;
  for (const [from, to] of blocksOf(e)) {
    if (!from && !to) continue;
    if (!from || !to) return "Zeitblock unvollständig (Beginn und Ende angeben)";
    const f = toMin(from);
    const t = toMin(to);
    if (t <= f) return "Das Ende muss nach dem Beginn liegen";
    if (f < lastEnd) return "Die Zeitblöcke überschneiden sich";
    lastEnd = t;
  }
  return null;
}

/** Arbeitsminuten (nur gültige, vollständige Blöcke) */
export function entryMinutes(e: TimeEntry): number {
  return blocksOf(e).reduce((sum, [from, to]) => {
    if (!from || !to) return sum;
    const diff = toMin(to) - toMin(from);
    return diff > 0 ? sum + diff : sum;
  }, 0);
}

export const isEmptyEntry = (e: TimeEntry) =>
  TIME_KEYS.every((k) => !e[k]) && !e.meal && !e.note.trim();

export function summarize(entries: TimeEntry[]) {
  return entries.reduce(
    (acc, e) => {
      const m = entryMinutes(e);
      acc.minutes += m;
      if (m > 0) acc.days += 1;
      if (e.meal) acc.meals += 1;
      return acc;
    },
    { minutes: 0, days: 0, meals: 0 },
  );
}

type Row = Record<string, any>;

export function fromRow(r: Row): TimeEntry {
  const t = (v: unknown) => (typeof v === "string" ? v.slice(0, 5) : "");
  return {
    date: r.date,
    t1_from: t(r.t1_from), t1_to: t(r.t1_to),
    t2_from: t(r.t2_from), t2_to: t(r.t2_to),
    t3_from: t(r.t3_from), t3_to: t(r.t3_to),
    meal: !!r.meal,
    note: r.note ?? "",
  };
}

export function toRow(e: TimeEntry, employeeId: string) {
  const v = (s: string) => (s ? s : null);
  return {
    employee_id: employeeId,
    date: e.date,
    t1_from: v(e.t1_from), t1_to: v(e.t1_to),
    t2_from: v(e.t2_from), t2_to: v(e.t2_to),
    t3_from: v(e.t3_from), t3_to: v(e.t3_to),
    meal: e.meal,
    note: e.note.trim() ? e.note.trim().slice(0, 300) : null,
    updated_at: new Date().toISOString(),
  };
}