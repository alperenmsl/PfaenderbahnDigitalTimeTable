import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  MONTHS,
  TimeEntry,
  daysInMonth,
  fmtDec,
  fmtHM,
  fromRow,
  isoDate,
  summarize,
} from "../utils/time";
import {
  PersonMonth,
  exportAll,
  exportPerson,
  profileName,
} from "../utils/timeExcel";
import "../timesheet.css";

type Person = {
  id: string;
  name: string;
  entries: TimeEntry[];
  submitted: boolean;
};

/** Nur für Bertl (Planer). Zugriff in App.tsx genauso absichern wie VacationAdmin. */
export default function TimeAdmin() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [m0, setM0] = useState(now.getMonth());
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  const monthStart = isoDate(year, m0, 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      const [pr, er, mr] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase
          .from("time_entries")
          .select("*")
          .gte("date", monthStart)
          .lte("date", isoDate(year, m0, daysInMonth(year, m0))),
        supabase
          .from("time_months")
          .select("employee_id")
          .eq("month", monthStart),
      ]);
      if (cancelled) return;
      const err = pr.error ?? er.error ?? mr.error;
      if (err) setError(err.message);
      const byEmp = new Map<string, TimeEntry[]>();
      (er.data ?? []).forEach((r: any) => {
        const arr = byEmp.get(r.employee_id) ?? [];
        arr.push(fromRow(r));
        byEmp.set(r.employee_id, arr);
      });
      const done = new Set((mr.data ?? []).map((r: any) => r.employee_id));
      setPeople(
        (pr.data ?? [])
          .map((p: any) => ({
            id: p.id,
            name: profileName(p),
            entries: byEmp.get(p.id) ?? [],
            submitted: done.has(p.id),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "de")),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [year, m0, monthStart, reload]);

  const rows = useMemo(
    () => people.map((p) => ({ ...p, s: summarize(p.entries) })),
    [people],
  );
  const withData = rows.filter((r) => r.entries.length > 0);
  const submittedCount = withData.filter((r) => r.submitted).length;

  function shift(delta: number) {
    const d = new Date(year, m0 + delta, 1);
    setYear(d.getFullYear());
    setM0(d.getMonth());
  }

  async function downloadAll() {
    const open = withData.length - submittedCount;
    if (
      open > 0 &&
      !confirm(
        `${open} Mitarbeiter haben den Monat noch nicht abgegeben. Trotzdem herunterladen?`,
      )
    )
      return;
    setBusy(true);
    const list: PersonMonth[] = withData.map((r) => ({
      name: r.name,
      entries: r.entries,
      submitted: r.submitted,
    }));
    await exportAll(year, m0, list);
    setBusy(false);
  }

  async function reopen(p: Person) {
    if (!confirm(`${p.name}: ${MONTHS[m0]} ${year} wieder öffnen?`)) return;
    const { error } = await supabase
      .from("time_months")
      .delete()
      .eq("employee_id", p.id)
      .eq("month", monthStart);
    if (error) alert(error.message);
    else setReload((n) => n + 1);
  }

  return (
    <div className="ts-page">
      <header className="ts-hero">
        <div>
          <h1>Zeiten für die Buchhaltung</h1>
          <p>Alle Zeiterfassungen eines Monats in einer Excel-Datei.</p>
        </div>
        <div className="ts-hero-actions">
          <button
            className="ts-btn ts-btn-white"
            disabled={busy || loading || withData.length === 0}
            onClick={downloadAll}
          >
            {busy ? "Erstelle …" : "Alle als Excel herunterladen"}
          </button>
        </div>
      </header>

      <div className="ts-bar">
        <div className="ts-nav">
          <button onClick={() => shift(-1)} aria-label="Vorheriger Monat">
            ‹
          </button>
          <strong>
            {MONTHS[m0]} {year}
          </strong>
          <button onClick={() => shift(1)} aria-label="Nächster Monat">
            ›
          </button>
        </div>
        <div className="ts-stats">
          <span>
            <b>{submittedCount}</b> von <b>{withData.length}</b> abgegeben
          </span>
        </div>
      </div>

      {error && <div className="ts-notice ts-notice-err">{error}</div>}

      <div className="ts-card">
        <div className="ts-scroll">
          <table className="ts-table ts-admin">
            <thead>
              <tr>
                <th>Mitarbeiter</th>
                <th>Tage</th>
                <th>Stunden</th>
                <th>Dezimal</th>
                <th>Essen</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="ts-empty">
                    Lade …
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => (
                  <tr key={r.id} className="ts-row">
                    <td className="ts-day">{r.name}</td>
                    <td className="ts-sum">{r.s.days}</td>
                    <td className="ts-sum">{fmtHM(r.s.minutes)}</td>
                    <td className="ts-sum">{fmtDec(r.s.minutes)}</td>
                    <td className="ts-sum">{r.s.meals}</td>
                    <td>
                      {r.submitted ? (
                        <span className="ts-pill ts-pill-ok">Abgegeben</span>
                      ) : r.entries.length ? (
                        <span className="ts-pill ts-pill-open">Offen</span>
                      ) : (
                        <span className="ts-pill">Keine Einträge</span>
                      )}
                    </td>
                    <td className="ts-actions">
                      <button
                        className="ts-btn ts-btn-small"
                        disabled={!r.entries.length}
                        onClick={() =>
                          exportPerson(r.name, year, m0, r.entries)
                        }
                      >
                        Excel
                      </button>
                      {r.submitted && (
                        <button
                          className="ts-btn ts-btn-small ts-btn-outline"
                          onClick={() => reopen(r)}
                        >
                          Wieder öffnen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
