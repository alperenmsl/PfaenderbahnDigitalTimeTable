import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { SHIFT_COLORS } from "../data";
import type { Employee, ShiftColor } from "../types";

import BIcon from "./BIcon";
type Props = { employees: Employee[]; meId: string };

type Entry = { employee_id: string; shift_color: string; note: string | null };
type Ev = {
  id: string;
  date: string;
  title: string;
  description: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const ABSENT = ["krank", "urlaub"];
const IGNORE = ["frei", "feiertag"];

const initials = (n: string) =>
  n
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");

export default function DashboardWidgets({ employees, meId }: Props) {
  const [today, setToday] = useState<Entry[] | null>(null);
  const [events, setEvents] = useState<Ev[] | null>(null);

  useEffect(() => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 14);
    Promise.all([
      supabase
        .from("schedule_published")
        .select("employee_id, shift_color, note")
        .eq("date", iso(now)),
      supabase
        .from("events")
        .select("id, date, title, description")
        .gte("date", iso(now))
        .lte("date", iso(end))
        .order("date"),
    ]).then(([s, e]) => {
      setToday((s.data ?? []) as Entry[]);
      setEvents((e.data ?? []) as Ev[]);
    });
  }, []);

  const byId = (id: string) => employees.find((e) => e.id === id);
  const working = (today ?? [])
    .filter(
      (r) => !ABSENT.includes(r.shift_color) && !IGNORE.includes(r.shift_color),
    )
    .sort(
      (a, b) =>
        a.shift_color.localeCompare(b.shift_color) ||
        (byId(a.employee_id)?.name ?? "").localeCompare(
          byId(b.employee_id)?.name ?? "",
        ),
    );
  // Aus Datenschutzgründen: nur "abwesend", ohne Grund
  const absent = (today ?? []).filter((r) => ABSENT.includes(r.shift_color));

  return (
    <div className="dash-grid">
      <div className="dash-card">
        <div className="dash-title">
          <span>
            <BIcon name="people" size={16} /> Heute im Dienst
          </span>
          {today && <span className="dash-count">{working.length}</span>}
        </div>

        {today === null ? (
          <div className="dash-empty">Lade…</div>
        ) : working.length === 0 ? (
          <div className="dash-empty">
            Für heute ist noch kein Dienst veröffentlicht.
          </div>
        ) : (
          working.map((r) => {
            const emp = byId(r.employee_id);
            if (!emp) return null;
            const ci = SHIFT_COLORS[r.shift_color as ShiftColor];
            return (
              <div
                key={r.employee_id}
                className={`m-emp-row ${r.employee_id === meId ? "me" : ""}`}
                style={{ marginBottom: 6 }}
              >
                <div className="m-avatar">
                  {emp.avatarUrl ? (
                    <img
                      src={emp.avatarUrl}
                      alt={emp.name}
                      loading="lazy"
                      onError={(e) =>
                        ((e.currentTarget as HTMLImageElement).style.display =
                          "none")
                      }
                    />
                  ) : (
                    initials(emp.name)
                  )}
                </div>
                <div className="m-emp-name">{emp.name}</div>
                <div
                  className="m-pill"
                  style={{ background: ci?.bg, color: ci?.text, minWidth: 80 }}
                >
                  {r.note || ci?.label || r.shift_color}
                </div>
              </div>
            );
          })
        )}

        {absent.length > 0 && (
          <div className="dash-absent">
            Heute abwesend ({absent.length}):{" "}
            {absent
              .map((r) => byId(r.employee_id)?.name.split(" ")[0])
              .filter(Boolean)
              .join(", ")}
          </div>
        )}
      </div>

      <div className="dash-card">
        <div className="dash-title">
          <span>
            <BIcon name="pin-angle" size={16} /> Termine &amp; Hinweise
          </span>
          {events && <span className="dash-count">{events.length}</span>}
        </div>

        {events === null ? (
          <div className="dash-empty">Lade…</div>
        ) : events.length === 0 ? (
          <div className="dash-empty">
            Keine Termine in den nächsten 14 Tagen.
          </div>
        ) : (
          events.map((ev) => {
            const [y, m, d] = ev.date.split("-").map(Number);
            const wd = WD[new Date(y, m - 1, d).getDay()];
            return (
              <div key={ev.id} className="dash-event">
                <div className="dash-date">
                  <span>{wd}</span>
                  <b>
                    {pad(d)}.{pad(m)}.
                  </b>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {ev.title}
                  </div>
                  {ev.description && (
                    <div
                      style={{ fontSize: 12.5, color: "#6B7385", marginTop: 2 }}
                    >
                      {ev.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
