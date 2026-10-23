import { useState, useEffect, useMemo, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import Login from "./pages/Login";
import SickLeaveUpload from "./pages/SickLeaveUpload";
import BLOverview from "./pages/BLOverview";
import {
  EMPLOYEES,
  SHIFT_COLORS,
  generateWeekDates,
  getMondayOfDate,
  addWeeks,
  formatDateDisplay,
  formatDate,
} from "./data";
import {
  ScheduleData,
  DayEvent,
  ShiftColor,
  ShiftEntry,
  Employee,
} from "./types";

type Profile = { id: string; full_name: string; role: "employee" | "planner" };

/* ---------- Hilfsfunktionen ---------- */
// App-intern: dd/mm/yyyy  |  Datenbank: yyyy-mm-dd
const toISO = (dmy: string) => {
  const [d, m, y] = dmy.split("/");
  return `${y}-${m}-${d}`;
};
const fromISO = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

const WEEKDAYS = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];
const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];
const getWeekdayLong = (date: string) => {
  const [d, m, y] = date.split("/").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
};

function Avatar({ emp, size = 42 }: { emp?: Employee; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!emp) return null;
  const showImg = emp.avatarUrl && !broken;
  return (
    <div
      className="avatar2"
      style={{
        width: size,
        height: size,
        background: showImg ? undefined : "#cbd5e1",
        color: "#0f172a",
      }}
    >
      {showImg ? (
        <img
          src={emp.avatarUrl}
          alt={emp.name}
          className="avatar-img"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        getInitials(emp.name)
      )}
    </div>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const pillStyle = (entry: ShiftEntry, compact = false): React.CSSProperties => {
  const ci = SHIFT_COLORS[entry.color];
  const isFrei = entry.color === "frei" && !entry.note;
  const base: React.CSSProperties = compact
    ? {
        fontSize: 11.5,
        padding: "6px 8px",
        borderRadius: 9,
        width: "100%",
        textAlign: "center",
        fontWeight: 600,
        lineHeight: 1.3,
        border: "1px solid transparent",
      }
    : {};
  return isFrei
    ? {
        ...base,
        background: "#F2F5FA",
        color: "#8E97A9",
        borderColor: "#EEF0F4",
      }
    : {
        ...base,
        borderColor: ci.bg,
        background: ci.bg + "1A",
        color: ci.text === "#FFFFFF" ? ci.bg : ci.text,
      };
};
const pillLabel = (entry: ShiftEntry, freiText = "Frei") =>
  entry.note
    ? entry.note
    : entry.color === "frei"
      ? freiText
      : SHIFT_COLORS[entry.color].label;

/* ---------- App ---------- */
function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string }[]>(
    [],
  );

  const [weekMonday, setWeekMonday] = useState(() =>
    formatDate(getMondayOfDate(new Date())),
  );
  const dates = useMemo(() => generateWeekDates(weekMonday), [weekMonday]);

  const [schedule, setSchedule] = useState<ScheduleData>({});
  const [events, setEvents] = useState<DayEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [activeNav, setActiveNav] = useState("overview");
  const [showAllPlan, setShowAllPlan] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [editingCell, setEditingCell] = useState<{
    empId: string;
    date: string;
  } | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventDraft, setEventDraft] = useState({
    id: null as string | null,
    date: "",
    title: "",
    description: "",
  });

  const [pwNew, setPwNew] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const isPlanner = profile?.role === "planner";

  // Mitarbeiterliste: feste Reihenfolge/Avatare aus data.ts, ID aus der Datenbank
  const employees: Employee[] = useMemo(
    () =>
      EMPLOYEES.flatMap((e) => {
        const p = profiles.find((x) => x.full_name === e.name);
        return p ? [{ ...e, id: p.id }] : [];
      }),
    [profiles],
  );
  const me = employees.find((e) => e.id === session?.user.id);

  /* --- Uhr --- */
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* --- Auth-Sitzung --- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  /* --- Profile nach Login laden --- */
  useEffect(() => {
    if (!session) {
      setProfile(null);
      setProfiles([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("active", true);
      const list = (data ?? []) as Profile[];
      setProfiles(list.map((p) => ({ id: p.id, full_name: p.full_name })));
      setProfile(list.find((p) => p.id === session.user.id) ?? null);
    })();
  }, [session]);

  /* --- Dienstplan + Events der angezeigten Woche --- */
  const loadWeek = useCallback(async () => {
    const from = toISO(dates[0]);
    const to = toISO(dates[6]);
    const [{ data: sch }, { data: ev }] = await Promise.all([
      supabase
        .from("schedule")
        .select("employee_id, date, shift_color, note")
        .gte("date", from)
        .lte("date", to),
      supabase
        .from("events")
        .select("id, date, title, description")
        .gte("date", from)
        .lte("date", to),
    ]);
    const parsed: ScheduleData = {};
    (sch ?? []).forEach((r) => {
      const d = fromISO(r.date);
      (parsed[r.employee_id] ??= {})[d] = {
        color: r.shift_color as ShiftColor,
        note: r.note || undefined,
      };
    });
    setSchedule(parsed);
    setEvents(
      (ev ?? []).map((e) => ({
        id: e.id,
        date: fromISO(e.date),
        title: e.title,
        description: e.description || undefined,
      })),
    );
  }, [dates]);

  useEffect(() => {
    if (session) loadWeek();
  }, [session, loadWeek]);

  /* --- Ungelesene Krankmeldungen (nur Planer) --- */
  const refreshUnread = useCallback(async () => {
    if (!isPlanner) return;
    const { count } = await supabase
      .from("absences")
      .select("id", { count: "exact", head: true })
      .eq("type", "sick")
      .eq("status", "submitted");
    setUnreadCount(count ?? 0);
  }, [isPlanner]);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread]);

  /* --- Navigation --- */
  const handleWeekChange = (offset: number) =>
    setWeekMonday(addWeeks(weekMonday, offset));
  const handleGoToday = () =>
    setWeekMonday(formatDate(getMondayOfDate(new Date())));
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setActiveNav("overview");
    setShowAllPlan(false);
  };

  const getCell = (empId: string, date: string): ShiftEntry =>
    schedule[empId]?.[date] || { color: "frei" };

  /* --- Zelle bearbeiten (nur Planer; die Datenbank erzwingt das zusätzlich) --- */
  const handleCellClick = (emp: Employee, date: string) => {
    if (!isPlanner) return;
    setEditingCell({ empId: emp.id, date });
    setNoteInput(getCell(emp.id, date).note || "");
  };

  const saveCell = async (color: ShiftColor, note: string) => {
    if (!editingCell) return;
    const { empId, date } = editingCell;
    const cleanNote = note.trim();
    const isEmpty = color === "frei" && !cleanNote;

    const { error } = isEmpty
      ? await supabase
          .from("schedule")
          .delete()
          .eq("employee_id", empId)
          .eq("date", toISO(date))
      : await supabase.from("schedule").upsert(
          {
            employee_id: empId,
            date: toISO(date),
            shift_color: color,
            note: cleanNote || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "employee_id,date" },
        );
    if (error) return alert("Speichern fehlgeschlagen: " + error.message);

    setSchedule((prev) => {
      const next = { ...prev, [empId]: { ...(prev[empId] || {}) } };
      if (isEmpty) delete next[empId][date];
      else next[empId][date] = { color, note: cleanNote || undefined };
      return next;
    });
    setEditingCell(null);
    setNoteInput("");
  };

  /* --- Events --- */
  const openNewEventModal = () => {
    setEventDraft({ id: null, date: "", title: "", description: "" });
    setShowEventModal(true);
  };
  const openEditEventModal = (ev: DayEvent) => {
    setEventDraft({
      id: ev.id,
      date: toISO(ev.date),
      title: ev.title,
      description: ev.description || "",
    });
    setShowEventModal(true);
  };
  const handleSaveEvent = async () => {
    if (!eventDraft.date || !eventDraft.title.trim()) return;
    const row = {
      date: eventDraft.date,
      title: eventDraft.title.trim(),
      description: eventDraft.description || null,
    };
    const { error } = eventDraft.id
      ? await supabase.from("events").update(row).eq("id", eventDraft.id)
      : await supabase.from("events").insert(row);
    if (error) return alert("Speichern fehlgeschlagen: " + error.message);
    setShowEventModal(false);
    loadWeek();
  };
  const handleDeleteEvent = async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return alert("Löschen fehlgeschlagen: " + error.message);
    setShowEventModal(false);
    loadWeek();
  };
  const getEventsForDate = (date: string) =>
    events.filter((e) => e.date === date);

  /* --- PIN ändern --- */
  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwNew.length < 6)
      return setPwMsg({ ok: false, text: "Mindestens 6 Zeichen." });
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    if (error) return setPwMsg({ ok: false, text: error.message });
    setPwNew("");
    setPwMsg({ ok: true, text: "PIN wurde geändert." });
  };

  /* --- Anzeige-Texte --- */
  const currentWeekRange = (() => {
    const [fd, fm, fy] = dates[0].split("/");
    const [ld, lm, ly] = dates[6].split("/");
    if (fm === lm && fy === ly)
      return `${fd}. – ${ld}. ${MONTHS[parseInt(fm) - 1]} ${fy}`;
    return `${fd}.${fm}. – ${ld}.${lm}.${ly}`;
  })();
  const formatTime = (d: Date) =>
    d.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  const todayStr = formatDate(new Date());

  /* ---------- Rendering ---------- */
  if (authLoading) return <div style={{ padding: 40 }}>Lade…</div>;
  if (!session) return <Login />;
  if (!profile) return <div style={{ padding: 40 }}>Profil wird geladen…</div>;

  const weekNav = (
    <div className="month-nav-optivio">
      <button className="nav-arrow" onClick={() => handleWeekChange(-1)}>
        <Icon>
          <polyline points="15 18 9 12 15 6" />
        </Icon>
      </button>
      <div className="month-display">
        <span className="month-text">{currentWeekRange}</span>
      </div>
      <button className="nav-arrow" onClick={() => handleWeekChange(1)}>
        <Icon>
          <polyline points="9 18 15 12 9 6" />
        </Icon>
      </button>
      <button className="today-btn" onClick={handleGoToday}>
        Heute
      </button>
    </div>
  );

  const editingEmp = editingCell
    ? employees.find((e) => e.id === editingCell.empId)
    : undefined;
  const editColors: ShiftColor[] = editingEmp
    ? Array.from(new Set<ShiftColor>([...editingEmp.allowedColors, "frei"]))
    : [];

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Avatar emp={me} size={30} />
          </div>
          <span className="logo-text">OPTIVIO</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeNav === "overview" ? "active" : ""}`}
            onClick={() => setActiveNav("overview")}
          >
            <Icon>
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </Icon>
            Übersicht
          </button>

          {!isPlanner && (
            <button
              className={`nav-item ${activeNav === "krankenstand" ? "active" : ""}`}
              onClick={() => setActiveNav("krankenstand")}
            >
              <Icon>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </Icon>
              Krankenstand
            </button>
          )}

          {isPlanner && (
            <button
              className={`nav-item ${activeNav === "krankenbescheinigungen" ? "active" : ""}`}
              onClick={() => setActiveNav("krankenbescheinigungen")}
              style={{ position: "relative" }}
            >
              <Icon>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </Icon>
              <span>Krankenbescheinigungen</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    right: 12,
                    background: "#EF4444",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 99,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-divider" />
          <button
            className={`nav-item ${activeNav === "settings" ? "active" : ""}`}
            onClick={() => setActiveNav("settings")}
          >
            <Icon>
              <circle cx="12" cy="12" r="3" />
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            </Icon>
            Einstellungen
          </button>
          <button className="nav-item logout" onClick={handleLogout}>
            <Icon>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </Icon>
            Abmelden
          </button>
        </div>
      </aside>

      {/* HAUPTBEREICH */}
      <main
        className="main-content"
        style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}
      >
        {/* MITARBEITER-ÜBERSICHT */}
        {activeNav === "overview" && !isPlanner && (
          <>
            <div className="employee-personal-header">
              <div
                className="employee-personal-avatar"
                style={{ padding: 0, background: "#cbd5e1" }}
              >
                {me?.avatarUrl ? (
                  <img
                    src={me.avatarUrl}
                    alt={me.name}
                    className="avatar-img"
                  />
                ) : (
                  getInitials(profile.full_name)
                )}
              </div>
              <div className="employee-personal-meta">
                <h2>{profile.full_name}</h2>
                <p>
                  Dein persönlicher Dienstplan •{" "}
                  <span style={{ color: "var(--opt-blue)", fontWeight: 600 }}>
                    {formatTime(currentTime)} Uhr
                  </span>
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 22,
                flexWrap: "wrap",
                gap: 14,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    color: "var(--text)",
                    lineHeight: 1.2,
                  }}
                >
                  <span style={{ color: "var(--opt-blue)" }}>Mein</span>{" "}
                  Dienstplan
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    marginTop: 4,
                  }}
                >
                  {currentWeekRange} • 7-Tage-Wochenansicht (Mo – So)
                </div>
              </div>
              {weekNav}
            </div>

            <div className="toggle-row">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showAllPlan}
                  onChange={(e) => setShowAllPlan(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
              <div className="toggle-info">
                <div className="toggle-label">Allgemeiner Plan anzeigen</div>
                <div className="toggle-desc">
                  Wenn aktiviert, siehst du neben deinem Plan auch alle anderen
                  Mitarbeiter.
                </div>
              </div>
            </div>

            <div className="employee-schedule-wrap">
              <div className="employee-schedule-title">
                {showAllPlan
                  ? "Dienstplan der gesamten Woche (Alle)"
                  : "Deine Dienstzeiten dieser Woche"}
              </div>

              {!showAllPlan ? (
                <div
                  className="employee-schedule-grid"
                  style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
                >
                  {dates.map((date) => {
                    const entry = getCell(profile.id, date);
                    return (
                      <div
                        key={date}
                        className={`emp-day-card ${date === todayStr ? "today" : ""}`}
                      >
                        <div className="emp-day-weekday">
                          {getWeekdayLong(date).toUpperCase().slice(0, 2)}
                        </div>
                        <div className="emp-day-date">
                          {formatDateDisplay(date).split(".")[0]}.
                        </div>
                        <div className="emp-day-shift" style={pillStyle(entry)}>
                          {pillLabel(entry, "— Frei —")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  className="personal-timetable-card"
                  style={{ border: "none", padding: 0, margin: 0 }}
                >
                  <div className="pt-row head">
                    <div
                      className="pt-cell head-cell"
                      style={{
                        borderLeft: "none",
                        textAlign: "left",
                        alignItems: "flex-start",
                      }}
                    >
                      <div className="weekday">MITARBEITER</div>
                      <div className="day-date" style={{ fontSize: 13 }}>
                        Dienstplan
                      </div>
                    </div>
                    {dates.map((date) => (
                      <div
                        key={date}
                        className={`pt-cell head-cell ${date === todayStr ? "today" : ""}`}
                      >
                        <div className="weekday">
                          {getWeekdayLong(date).toUpperCase()}
                        </div>
                        <div className="day-date">
                          {formatDateDisplay(date).split(".")[0]}.
                        </div>
                      </div>
                    ))}
                  </div>
                  {employees.map((e) => {
                    const isMe = e.id === profile.id;
                    return (
                      <div key={e.id} className="pt-row">
                        <div
                          className="pt-employee"
                          style={{
                            background: isMe ? "#EEF4FF" : undefined,
                            borderRadius: "0 0 0 8px",
                          }}
                        >
                          <Avatar emp={e} size={36} />
                          <div>
                            <div
                              className="pt-employee-name"
                              style={{
                                fontWeight: isMe ? 800 : 600,
                                color: isMe ? "var(--opt-blue)" : undefined,
                              }}
                            >
                              {e.isAdmin && (
                                <span style={{ color: "#F59E0B" }}>★ </span>
                              )}
                              {e.name}
                            </div>
                            {isMe && (
                              <div
                                style={{
                                  fontSize: 10.5,
                                  color: "var(--opt-blue)",
                                  fontWeight: 700,
                                  marginTop: 2,
                                }}
                              >
                                Das bist du
                              </div>
                            )}
                          </div>
                        </div>
                        {dates.map((date) => {
                          const entry = getCell(e.id, date);
                          const isToday = date === todayStr;
                          const dayEvents = getEventsForDate(date);
                          return (
                            <div
                              key={date}
                              className={`pt-cell ${isToday ? "today" : ""}`}
                              style={{
                                background:
                                  isMe && isToday
                                    ? "#E6EEFF"
                                    : isToday
                                      ? "#EEF4FF"
                                      : isMe
                                        ? "#F8FAFF"
                                        : undefined,
                              }}
                            >
                              <div style={pillStyle(entry, true)}>
                                {pillLabel(entry)}
                              </div>
                              {dayEvents.length > 0 && (
                                <div
                                  title={dayEvents
                                    .map((ev) => ev.title)
                                    .join(", ")}
                                  style={{
                                    fontSize: 9,
                                    padding: "2px 6px",
                                    background: "#FEF3C7",
                                    color: "#92400E",
                                    borderRadius: 6,
                                    fontWeight: 600,
                                  }}
                                >
                                  📌 {dayEvents[0].title.slice(0, 12)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* PLANER-ÜBERSICHT (Bertl) */}
        {activeNav === "overview" && isPlanner && (
          <>
            <div className="page-header">
              <div className="page-title-section">
                <h1 className="page-title">
                  <span className="brand-blue">Optivio</span> - Pfänderbahn
                </h1>
                <p className="page-subtitle">
                  Digitaler Dienstplan • {formatTime(currentTime)} Uhr
                </p>
              </div>
              <div className="page-actions">
                {weekNav}
                <button className="btn btn-action" onClick={openNewEventModal}>
                  Event
                </button>
              </div>
            </div>

            <div className="admin-banner">
              <span>
                Als <strong>{profile.full_name}</strong> angemeldet — klicke auf
                eine Zelle, um den Dienstplan zu bearbeiten.
              </span>
            </div>

            <div className="timetable-card">
              <div className="timetable-wrapper-opt">
                <table className="timetable-opt">
                  <thead>
                    <tr>
                      <th className="opt-col-employee">MITARBEITER</th>
                      {dates.map((date) => {
                        const evs = getEventsForDate(date);
                        return (
                          <th key={date} className="opt-col-date">
                            {getWeekdayLong(date).toUpperCase()}
                            <div style={{ fontSize: 11, opacity: 0.7 }}>
                              {formatDateDisplay(date).slice(0, 5)}
                            </div>
                            {evs.map((ev) => (
                              <div
                                key={ev.id}
                                onClick={() => openEditEventModal(ev)}
                                title={ev.description}
                                style={{
                                  fontSize: 10,
                                  marginTop: 4,
                                  padding: "2px 6px",
                                  background: "#FEF3C7",
                                  color: "#92400E",
                                  borderRadius: 6,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                📌 {ev.title.slice(0, 14)}
                              </div>
                            ))}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id} className="t-row">
                        <td className="opt-col-employee-body">
                          <div className="employee-card2">
                            <Avatar emp={emp} size={42} />
                            <div className="emp-name2">
                              {emp.isAdmin && (
                                <span className="admin-star-mini">★</span>
                              )}{" "}
                              {emp.name}
                            </div>
                          </div>
                        </td>
                        {dates.map((date) => {
                          const entry = getCell(emp.id, date);
                          const isFrei = entry.color === "frei" && !entry.note;
                          const ci = SHIFT_COLORS[entry.color];
                          return (
                            <td
                              key={date}
                              className="opt-col-body editable-opt"
                              onClick={() => handleCellClick(emp, date)}
                            >
                              <div
                                className={`shift-pill ${isFrei ? "frei" : ""}`}
                                style={
                                  !isFrei
                                    ? {
                                        borderColor: ci.bg,
                                        background: ci.bg + "14",
                                        color: ci.bg,
                                      }
                                    : {}
                                }
                              >
                                <span>{pillLabel(entry)}</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeNav === "krankenstand" && !isPlanner && <SickLeaveUpload />}
        {activeNav === "krankenbescheinigungen" && isPlanner && (
          <BLOverview onChange={refreshUnread} />
        )}

        {activeNav === "settings" && (
          <div style={{ maxWidth: 520, margin: "0 auto", paddingTop: 20 }}>
            <div className="page-header" style={{ marginBottom: 24 }}>
              <div className="page-title-section">
                <h1 className="page-title">
                  <span className="brand-blue">Einstellungen</span>
                </h1>
                <p className="page-subtitle">
                  Hier kannst du deine PIN ändern.
                </p>
              </div>
            </div>
            <form
              onSubmit={handleChangePw}
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: 28,
                border: "1px solid #EEF0F4",
              }}
            >
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#6B7385",
                  textTransform: "uppercase",
                }}
              >
                Neue PIN / neues Passwort
              </label>
              <input
                type="password"
                className="opt-input"
                autoComplete="new-password"
                value={pwNew}
                onChange={(e) => {
                  setPwNew(e.target.value);
                  setPwMsg(null);
                }}
                style={{ marginTop: 6, marginBottom: 16 }}
              />
              <button
                type="submit"
                className="btn-save"
                style={{ padding: "10px 24px", borderRadius: 99 }}
              >
                PIN ändern
              </button>
              {pwMsg && (
                <p
                  style={{
                    marginTop: 12,
                    fontSize: 13,
                    fontWeight: 600,
                    color: pwMsg.ok ? "#059669" : "#DC2626",
                  }}
                >
                  {pwMsg.text}
                </p>
              )}
            </form>
          </div>
        )}
      </main>

      {/* MODAL: DIENST BEARBEITEN */}
      {editingCell && isPlanner && editingEmp && (
        <div
          className="modal-overlay"
          onClick={() => {
            setEditingCell(null);
            setNoteInput("");
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              width: "min(440px, 92vw)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>
              {editingEmp.name}
            </h3>
            <p style={{ fontSize: 13, color: "#6B7385", marginBottom: 16 }}>
              {getWeekdayLong(editingCell.date)},{" "}
              {formatDateDisplay(editingCell.date)}
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {editColors.map((c) => (
                <button
                  key={c}
                  onClick={() => saveCell(c, noteInput)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: SHIFT_COLORS[c].bg,
                    color: SHIFT_COLORS[c].text,
                    border: "1px solid rgba(0,0,0,0.12)",
                  }}
                >
                  {SHIFT_COLORS[c].label}
                </button>
              ))}
            </div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#6B7385",
                textTransform: "uppercase",
              }}
            >
              Notiz (optional, ersetzt die Anzeige)
            </label>
            <input
              className="opt-input"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="z. B. 08:00 – 14:00"
              style={{ marginTop: 6, width: "100%" }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 18,
              }}
            >
              <button
                className="btn"
                onClick={() => {
                  setEditingCell(null);
                  setNoteInput("");
                }}
              >
                Abbrechen
              </button>
              <button
                className="btn-save"
                style={{ padding: "8px 20px", borderRadius: 99 }}
                onClick={() =>
                  saveCell(
                    getCell(editingCell.empId, editingCell.date).color,
                    noteInput,
                  )
                }
              >
                Notiz speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EVENT */}
      {showEventModal && isPlanner && (
        <div
          className="modal-overlay"
          onClick={() => setShowEventModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              width: "min(440px, 92vw)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
              {eventDraft.id ? "Event bearbeiten" : "Neues Event"}
            </h3>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#6B7385",
                textTransform: "uppercase",
              }}
            >
              Datum
            </label>
            <input
              type="date"
              className="opt-input"
              value={eventDraft.date}
              onChange={(e) =>
                setEventDraft({ ...eventDraft, date: e.target.value })
              }
              style={{ margin: "6px 0 12px", width: "100%" }}
            />
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#6B7385",
                textTransform: "uppercase",
              }}
            >
              Titel
            </label>
            <input
              className="opt-input"
              value={eventDraft.title}
              onChange={(e) =>
                setEventDraft({ ...eventDraft, title: e.target.value })
              }
              style={{ margin: "6px 0 12px", width: "100%" }}
            />
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#6B7385",
                textTransform: "uppercase",
              }}
            >
              Beschreibung
            </label>
            <textarea
              className="opt-input"
              value={eventDraft.description}
              onChange={(e) =>
                setEventDraft({ ...eventDraft, description: e.target.value })
              }
              style={{ margin: "6px 0 12px", width: "100%", minHeight: 70 }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 8,
              }}
            >
              {eventDraft.id ? (
                <button
                  onClick={() => handleDeleteEvent(eventDraft.id!)}
                  style={{
                    background: "#FEF2F2",
                    color: "#DC2626",
                    border: "1px solid #FECACA",
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Löschen
                </button>
              ) : (
                <span />
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn"
                  onClick={() => setShowEventModal(false)}
                >
                  Abbrechen
                </button>
                <button
                  className="btn-save"
                  style={{ padding: "8px 20px", borderRadius: 99 }}
                  onClick={handleSaveEvent}
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
