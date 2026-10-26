import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  MONTHS,
  WEEKDAYS_SHORT,
  TimeEntry,
  TimeKey,
  daysInMonth,
  emptyEntry,
  entryIssue,
  entryMinutes,
  fmtDateDE,
  fmtDec,
  fmtHM,
  fromRow,
  isEmptyEntry,
  isoDate,
  summarize,
  toRow,
  weekdayOf,
} from "../utils/time";
import { exportPerson, profileName } from "../utils/timeExcel";
import "../timesheet.css";

type Status = "saving" | "saved" | "error";

const BLOCKS: [TimeKey, TimeKey][] = [
  ["t1_from", "t1_to"],
  ["t2_from", "t2_to"],
  ["t3_from", "t3_to"],
];

export default function TimeTracking() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [m0, setM0] = useState(now.getMonth());
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [entries, setEntries] = useState<Record<string, TimeEntry>>({});
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [loadError, setLoadError] = useState("");
  const timers = useRef<Record<string, number>>({});

  const monthStart = isoDate(year, m0, 1);
  const locked = !!submittedAt;

  // aktuellen Benutzer laden
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id ?? null;
      setUserId(id);
      if (id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (p) setUserName(profileName(p));
      }
    })();
  }, []);

  // Monat laden
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      const [er, mr] = await Promise.all([
        supabase
          .from("time_entries")
          .select("*")
          .eq("employee_id", userId)
          .gte("date", monthStart)
          .lte("date", isoDate(year, m0, daysInMonth(year, m0))),
        supabase
          .from("time_months")
          .select("submitted_at")
          .eq("employee_id", userId)
          .eq("month", monthStart)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (er.error)
        setLoadError(
          "Zeiten konnten nicht geladen werden: " + er.error.message,
        );
      const map: Record<string, TimeEntry> = {};
      (er.data ?? []).forEach((r) => {
        const e = fromRow(r);
        map[e.date] = e;
      });
      setEntries(map);
      setSubmittedAt(mr.data?.submitted_at ?? null);
      setStatus({});
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, year, m0, monthStart]);

  const days = useMemo(
    () =>
      Array.from({ length: daysInMonth(year, m0) }, (_, i) =>
        isoDate(year, m0, i + 1),
      ),
    [year, m0],
  );
  const list = days.map((d) => entries[d] ?? emptyEntry(d));
  const sum = summarize(list);
  const issues = list.filter((e) => entryIssue(e));

  async function save(e: TimeEntry) {
    if (!userId || entryIssue(e)) return;
    setStatus((s) => ({ ...s, [e.date]: "saving" }));
    const res = isEmptyEntry(e)
      ? await supabase
          .from("time_entries")
          .delete()
          .eq("employee_id", userId)
          .eq("date", e.date)
      : await supabase
          .from("time_entries")
          .upsert(toRow(e, userId), { onConflict: "employee_id,date" });
    setStatus((s) => ({ ...s, [e.date]: res.error ? "error" : "saved" }));
  }

  function change(date: string, patch: Partial<TimeEntry>) {
    const next = { ...(entries[date] ?? emptyEntry(date)), ...patch };
    setEntries((p) => ({ ...p, [date]: next }));
    window.clearTimeout(timers.current[date]);
    timers.current[date] = window.setTimeout(() => save(next), 600);
  }

  function shift(delta: number) {
    const d = new Date(year, m0 + delta, 1);
    setYear(d.getFullYear());
    setM0(d.getMonth());
  }

  async function submitMonth() {
    if (!userId) return;
    if (issues.length) {
      alert(
        `Bitte zuerst korrigieren: ${fmtDateDE(issues[0].date)} – ${entryIssue(issues[0])}`,
      );
      return;
    }
    if (
      !confirm(
        `${MONTHS[m0]} ${year} abgeben?\nDanach kannst du nichts mehr ändern – nur Bertl kann den Monat wieder öffnen.`,
      )
    )
      return;
    await new Promise((r) => setTimeout(r, 800)); // ausstehende Speicherungen abwarten
    const { error } = await supabase
      .from("time_months")
      .insert({ employee_id: userId, month: monthStart });
    if (error) alert("Abgabe fehlgeschlagen: " + error.message);
    else setSubmittedAt(new Date().toISOString());
  }

  const today = isoDate(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <div className="ts-page">
      <header className="ts-hero">
        <div>
          <h1>Zeiterfassung</h1>
          <p>
            Trage deine Arbeitszeiten ein – alles wird automatisch gespeichert.
          </p>
        </div>
        <div className="ts-hero-actions">
          <button
            className="ts-btn ts-btn-ghost"
            onClick={() =>
              exportPerson(userName || "Mitarbeiter", year, m0, list)
            }
          >
            Excel herunterladen
          </button>
          {!locked && (
            <button className="ts-btn ts-btn-white" onClick={submitMonth}>
              Monat abgeben
            </button>
          )}
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
            <b>{fmtHM(sum.minutes)}</b> Std.
          </span>
          <span>
            <b>{sum.days}</b> Tage
          </span>
          <span>
            <b>{sum.meals}</b> Essen
          </span>
        </div>
      </div>

      {locked && (
        <div className="ts-notice">
          Dieser Monat wurde am{" "}
          {new Date(submittedAt!).toLocaleDateString("de-AT")} abgegeben und ist
          gesperrt. Für Änderungen wende dich an Bertl.
        </div>
      )}
      {loadError && <div className="ts-notice ts-notice-err">{loadError}</div>}

      <div className="ts-card">
        <div className="ts-scroll">
          <table className="ts-table">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Arbeitszeit 1</th>
                <th>Arbeitszeit 2</th>
                <th>Arbeitszeit 3</th>
                <th>Summe</th>
                <th>Essen</th>
                <th>Notiz</th>
                <th aria-label="Status" />
              </tr>
            </thead>
            <tbody>
              {days.map((date, i) => {
                const e = entries[date] ?? emptyEntry(date);
                const wd = weekdayOf(date);
                const min = entryMinutes(e);
                const issue = entryIssue(e);
                const st = status[date];
                const cls = [
                  "ts-row",
                  (wd === 0 || wd === 6) && "ts-weekend",
                  date === today && "ts-today",
                  issue && "ts-bad",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <tr key={date} className={cls}>
                    <td className="ts-day" data-label="Tag">
                      <span className="ts-dn">{i + 1}.</span>{" "}
                      {WEEKDAYS_SHORT[wd]}
                    </td>
                    {BLOCKS.map(([f, t], bi) => (
                      <td
                        key={f}
                        className="ts-block"
                        data-label={`Arbeitszeit ${bi + 1}`}
                      >
                        <input
                          type="time"
                          value={e[f]}
                          disabled={locked || loading}
                          onChange={(ev) =>
                            change(date, { [f]: ev.target.value })
                          }
                          aria-label={`Beginn ${bi + 1}`}
                        />
                        <span className="ts-dash">–</span>
                        <input
                          type="time"
                          value={e[t]}
                          disabled={locked || loading}
                          onChange={(ev) =>
                            change(date, { [t]: ev.target.value })
                          }
                          aria-label={`Ende ${bi + 1}`}
                        />
                      </td>
                    ))}
                    <td className="ts-sum" data-label="Summe">
                      {min ? fmtHM(min) : "–"}
                    </td>
                    <td className="ts-meal" data-label="Essen">
                      <label>
                        <input
                          type="checkbox"
                          checked={e.meal}
                          disabled={locked || loading}
                          onChange={(ev) =>
                            change(date, { meal: ev.target.checked })
                          }
                        />
                        <span>Essen</span>
                      </label>
                    </td>
                    <td className="ts-note">
                      <input
                        type="text"
                        value={e.note}
                        maxLength={300}
                        placeholder="Notiz"
                        disabled={locked || loading}
                        onChange={(ev) =>
                          change(date, { note: ev.target.value })
                        }
                      />
                    </td>
                    <td className="ts-state">
                      {issue ? (
                        <span className="ts-warn" title={issue}>
                          !
                        </span>
                      ) : st === "saving" ? (
                        <span
                          className="ts-dot ts-dot-busy"
                          title="Speichert …"
                        />
                      ) : st === "saved" ? (
                        <span
                          className="ts-dot ts-dot-ok"
                          title="Gespeichert"
                        />
                      ) : st === "error" ? (
                        <span
                          className="ts-warn"
                          title="Speichern fehlgeschlagen"
                        >
                          !
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Summe {MONTHS[m0]}</td>
                <td className="ts-sum">{fmtHM(sum.minutes)}</td>
                <td className="ts-meal">{sum.meals}×</td>
                <td colSpan={2} className="ts-dec">
                  {fmtDec(sum.minutes)} Std. dezimal
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      {issues.length > 0 && (
        <p className="ts-hint">
          {fmtDateDE(issues[0].date)}: {entryIssue(issues[0])} – dieser Tag wird
          erst gespeichert, wenn es passt.
        </p>
      )}
    </div>
  );
}
