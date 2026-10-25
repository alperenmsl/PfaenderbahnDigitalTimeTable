import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Employee, ShiftEntry, DayEvent } from "../types";

import BIcon from "./BIcon";
type Props = {
  dates: string[];
  employees: Employee[];
  getCell: (empId: string, date: string) => ShiftEntry;
  getEvents: (date: string) => DayEvent[];
  weekdayLong: (date: string) => string;
  styleFor: (entry: ShiftEntry) => CSSProperties;
  labelFor: (entry: ShiftEntry) => string;
  todayStr: string;
  meId: string;
  onCellClick?: (emp: Employee, date: string) => void;
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

export default function DayList({
  dates,
  employees,
  getCell,
  getEvents,
  weekdayLong,
  styleFor,
  labelFor,
  todayStr,
  meId,
  onCellClick,
}: Props) {
  const initial = () => (dates.includes(todayStr) ? todayStr : dates[0]);
  const [selected, setSelected] = useState(initial);

  // Beim Wochenwechsel automatisch auf einen sinnvollen Tag springen
  useEffect(() => {
    setSelected(initial());
  }, [dates[0], todayStr]);

  const events = getEvents(selected);

  return (
    <div>
      <div className="m-chips">
        {dates.map((d) => (
          <button
            key={d}
            className={`m-chip ${d === selected ? "active" : ""} ${d === todayStr ? "today" : ""}`}
            onClick={() => setSelected(d)}
          >
            <span>{weekdayLong(d).slice(0, 2).toUpperCase()}</span>
            <b>{d.slice(0, 2)}</b>
          </button>
        ))}
      </div>

      <div className="m-day-title">
        {weekdayLong(selected)}, {selected.replace(/\//g, ".")}
      </div>
      {onCellClick && (
        <div className="m-hint">
          Tippe auf einen Mitarbeiter, um den Dienst zu ändern.
        </div>
      )}

      {events.map((ev) => (
        <div key={ev.id} className="m-event">
          <BIcon name="pin-angle" size={13} /> {ev.title}
        </div>
      ))}

      {employees.map((emp) => {
        const entry = getCell(emp.id, selected);
        return (
          <div
            key={emp.id}
            className={`m-emp-row ${emp.id === meId ? "me" : ""} ${onCellClick ? "clickable" : ""}`}
            onClick={() => onCellClick?.(emp, selected)}
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
            <div className="m-emp-name">
              {emp.isAdmin && <span style={{ color: "#F59E0B" }}>★ </span>}
              {emp.name}
              {emp.id === meId && (
                <div style={{ fontSize: 11, color: "#165DFF" }}>
                  Das bist du
                </div>
              )}
            </div>
            <div className="m-pill" style={styleFor(entry)}>
              {labelFor(entry)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
