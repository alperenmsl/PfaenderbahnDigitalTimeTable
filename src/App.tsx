import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import SickLeaveUpload from "./pages/SickLeaveUpload";
import BertlOverview from "./pages/BLOverview";
import {
  EMPLOYEES,
  SHIFT_COLORS,
  generateDates,
  generateWeekDates,
  getMondayOfDate,
  addWeeks,
  formatDateDisplay,
  getWeekday,
  INITIAL_SCHEDULE,
  INITIAL_EVENTS,
  formatDate,
} from "./data";
import {
  ScheduleData,
  DayEvent,
  ShiftColor,
  ShiftEntry,
  Employee,
} from "./types";

const ADMIN_PASSWORD = "berthold2026";

type AuthMode = null | "employee" | "admin";

interface AuthState {
  mode: AuthMode;
  employeeId?: string;
  employeeName?: string;
}

function toISODate(dmy: string): string {
  if (!dmy) return "";
  const [d, m, y] = dmy.split("/");
  return `${y}-${m}-${d}`;
}
function fromISODate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function Avatar({ emp, size = 42 }: { emp?: Employee; size?: number }) {
  if (!emp) return null;
  const style: React.CSSProperties = {
    width: size,
    height: size,
  };
  if (emp.avatarUrl) {
    return (
      <div className="avatar2" style={style}>
        <img
          src={emp.avatarUrl}
          alt={emp.name}
          className="avatar-img"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
    );
  }
  const colors: Record<string, { bg: string; text: string }> = {
    "1": { bg: "#EF4444", text: "#fff" },
    "2": { bg: "#DC2626", text: "#fff" },
    "4": { bg: "#E11D48", text: "#fff" },
    "5": { bg: "#F59E0B", text: "#111" },
    "6": { bg: "#EAB308", text: "#111" },
    "7": { bg: "#FACC15", text: "#111" },
    "3": { bg: "#FF8C00", text: "#fff" },
    "8": { bg: "#22C55E", text: "#fff" },
    "9": { bg: "#16A34A", text: "#fff" },
    "10": { bg: "#15803D", text: "#fff" },
    "11": { bg: "#EC4899", text: "#fff" },
    "12": { bg: "#7C3AED", text: "#fff" },
    "13": { bg: "#A78BFA", text: "#fff" },
    "14": { bg: "#D97706", text: "#fff" },
    "15": { bg: "#B45309", text: "#fff" },
    "16": { bg: "#92400E", text: "#fff" },
    "17": { bg: "#0EA5E9", text: "#fff" },
  };
  const c = colors[emp.id] || { bg: "#cbd5e1", text: "#0f172a" };
  return (
    <div
      className="avatar2"
      style={{ ...style, background: c.bg, color: c.text }}
    >
      {emp.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")}
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}

function App() {
  const [weekMonday, setWeekMonday] = useState(() => {
    const m = getMondayOfDate(new Date()); // Nimmt jetzt automatisch den heutigen Tag
    return formatDate(m);
  });
  const [dates, setDates] = useState<string[]>(
    () => generateWeekDates(formatDate(getMondayOfDate(new Date()))), // Hier ebenfalls
  );

  const [schedule, setSchedule] = useState<ScheduleData>(() => {
    const saved = localStorage.getItem("pfanderbahn_schedule");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return INITIAL_SCHEDULE;
  });
  const [events, setEvents] = useState<DayEvent[]>(() => {
    const saved = localStorage.getItem("pfanderbahn_events");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return INITIAL_EVENTS;
  });

  const [auth, setAuth] = useState<AuthState>(() => {
    const saved = localStorage.getItem("pfanderbahn_auth");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return { mode: null };
  });

  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showAllPlan, setShowAllPlan] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    empId: string;
    date: string;
  } | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventDraft, setEventDraft] = useState<{
    id: string | null;
    date: string;
    title: string;
    description: string;
  }>({
    id: null,
    date: "",
    title: "",
    description: "",
  });
  const [noteInput, setNoteInput] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeNav, setActiveNav] = useState("overview");

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    localStorage.setItem("pfanderbahn_schedule", JSON.stringify(schedule));
  }, [schedule]);

  useEffect(() => {
    localStorage.setItem("pfanderbahn_events", JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem("pfanderbahn_auth", JSON.stringify(auth));
  }, [auth]);

  const loadDataFromSupabase = async () => {
    try {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("schedule")
        .select("*");
      if (!scheduleError && scheduleData && scheduleData.length > 0) {
        const parsed: ScheduleData = {};
        for (const row of scheduleData) {
          if (!parsed[row.employee_id]) parsed[row.employee_id] = {};
          parsed[row.employee_id][row.date] = {
            color: row.shift_color as ShiftColor,
            note: row.note || undefined,
          };
        }
        setSchedule(parsed);
      }

      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("*");
      if (!eventsError && eventsData && eventsData.length > 0) {
        setEvents(
          eventsData.map((ev) => ({
            id: String(ev.id),
            date: ev.date,
            title: ev.title,
            description: ev.description || undefined,
          })),
        );
      }
    } catch (e) {
      console.warn("Supabase Daten konnten nicht geladen werden:", e);
    }
  };

  const checkUnreadSickLeaves = async () => {
    try {
      const { data, error } = await supabase.from("sick_leaves").select("id");

      if (!error && data) {
        const totalCount = data.length;
        // Hole die Anzahl, die Bertl beim letzten Mal gesehen hat
        const lastSeenCountStr = localStorage.getItem(
          "pfanderbahn_last_seen_count",
        );
        const lastSeenCount = lastSeenCountStr
          ? parseInt(lastSeenCountStr, 10)
          : 0;

        // Berechne, wie viele NEUE seit dem letzten Klick dazugekommen sind
        const unread = totalCount - lastSeenCount;
        setUnreadCount(unread > 0 ? unread : 0);
      }
    } catch (e) {
      console.warn("Konnte Krankenzettel nicht prüfen", e);
    }
  };

  const saveScheduleToSupabase = async () => {
    try {
      const rows: any[] = [];
      for (const empId of Object.keys(schedule)) {
        for (const date of Object.keys(schedule[empId])) {
          const entry = schedule[empId][date];
          if (entry.color !== "frei" || entry.note) {
            rows.push({
              employee_id: empId,
              date,
              shift_color: entry.color,
              note: entry.note || null,
            });
          }
        }
      }
      await supabase
        .from("schedule")
        .upsert(rows, { onConflict: "employee_id,date" });
    } catch (e) {
      console.warn("Supabase Speichern fehlgeschlagen:", e);
    }
  };

  useEffect(() => {
    loadDataFromSupabase();
    checkUnreadSickLeaves();
  }, []);

  const handleWeekChange = (offset: number) => {
    const newMonday = addWeeks(weekMonday, offset);
    setWeekMonday(newMonday);
    setDates(generateWeekDates(newMonday));
  };

  const handleGoToday = () => {
    const m = getMondayOfDate(new Date());
    const md = formatDate(m);
    setWeekMonday(md);
    setDates(generateWeekDates(md));
  };

  const handleEmployeeLogin = async () => {
    if (!selectedEmployee) {
      setLoginError("Bitte wähle deinen Namen aus.");
      return;
    }
    setIsLoggingIn(true);
    setLoginError("");

    const emp = EMPLOYEES.find((e) => e.id === selectedEmployee);
    if (!emp) {
      setLoginError("Mitarbeiter nicht gefunden.");
      setIsLoggingIn(false);
      return;
    }

    if (emp.isAdmin) {
      setShowAdminPassword(true);
      setIsLoggingIn(false);
      return;
    }

    await new Promise((r) => setTimeout(r, 500));

    const m = getMondayOfDate(new Date());
    const md = formatDate(m);
    setWeekMonday(md);
    setDates(generateWeekDates(md));

    setAuth({
      mode: "employee",
      employeeId: emp.id,
      employeeName: emp.name,
    });
    setSelectedEmployee("");
    setIsLoggingIn(false);
  };

  const handleAdminPasswordSubmit = () => {
    if (adminPasswordInput === ADMIN_PASSWORD) {
      const emp = EMPLOYEES.find((e) => e.id === selectedEmployee);
      if (emp) {
        setAuth({
          mode: "admin",
          employeeId: emp.id,
          employeeName: emp.name,
        });
      }
      setShowAdminPassword(false);
      setAdminPasswordInput("");
      setSelectedEmployee("");
      setLoginError("");
    } else {
      setLoginError("Falsches Admin-Passwort.");
    }
  };

  const handleLogout = () => {
    setAuth({ mode: null });
    setShowAdminPassword(false);
    setAdminPasswordInput("");
    setSelectedEmployee("");
    setLoginError("");
    setShowAllPlan(false);
  };

  const getCell = (empId: string, date: string): ShiftEntry => {
    return schedule[empId]?.[date] || { color: "frei" };
  };

  const isAdminLoggedIn = auth.mode === "admin";

  const handleCellClick = (emp: Employee, date: string) => {
    if (!isAdminLoggedIn) return;
    setEditingCell({ empId: emp.id, date });
    setNoteInput(getCell(emp.id, date).note || "");
  };

  const handleColorChange = (color: ShiftColor) => {
    if (!editingCell) return;
    setSchedule((prev) => {
      const next = { ...prev };
      if (!next[editingCell.empId]) next[editingCell.empId] = {};
      next[editingCell.empId] = {
        ...next[editingCell.empId],
        [editingCell.date]: {
          color,
          note: noteInput || undefined,
        },
      };
      return next;
    });
  };

  const handleSaveNote = () => {
    if (!editingCell) return;
    setSchedule((prev) => {
      const next = { ...prev };
      if (!next[editingCell.empId]) next[editingCell.empId] = {};
      const current = next[editingCell.empId][editingCell.date] || {
        color: "frei",
      };
      next[editingCell.empId] = {
        ...next[editingCell.empId],
        [editingCell.date]: {
          ...current,
          note: noteInput || undefined,
        },
      };
      return next;
    });
    saveScheduleToSupabase();
  };

  const openNewEventModal = () => {
    setEventDraft({ id: null, date: "", title: "", description: "" });
    setShowEventModal(true);
  };

  const openEditEventModal = (ev: DayEvent) => {
    setEventDraft({
      id: ev.id,
      date: ev.date,
      title: ev.title,
      description: ev.description || "",
    });
    setShowEventModal(true);
  };

  const handleSaveEvent = async () => {
    if (!eventDraft.date || !eventDraft.title) return;
    if (eventDraft.id) {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventDraft.id
            ? {
                ...e,
                date: eventDraft.date,
                title: eventDraft.title,
                description: eventDraft.description,
              }
            : e,
        ),
      );
      try {
        await supabase
          .from("events")
          .update({
            date: eventDraft.date,
            title: eventDraft.title,
            description: eventDraft.description || null,
          })
          .eq("id", eventDraft.id);
      } catch {}
    } else {
      const event: DayEvent = {
        id: Date.now().toString(),
        date: eventDraft.date,
        title: eventDraft.title,
        description: eventDraft.description,
      };
      setEvents((prev) => [...prev, event]);
      try {
        await supabase.from("events").insert({
          id: parseInt(event.id),
          date: event.date,
          title: event.title,
          description: event.description || null,
        });
      } catch {}
    }
    setShowEventModal(false);
    setEventDraft({ id: null, date: "", title: "", description: "" });
  };

  const handleDeleteEvent = async (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (eventDraft.id === id) {
      setShowEventModal(false);
      setEventDraft({ id: null, date: "", title: "", description: "" });
    }
    try {
      await supabase.from("events").delete().eq("id", id);
    } catch {}
  };

  const getEventsForDate = (date: string): DayEvent[] => {
    return events.filter((e) => e.date === date);
  };

  const currentWeekRange = (() => {
    if (dates.length === 0) return "";
    const first = dates[0];
    const last = dates[dates.length - 1];
    const [fd, fm, fy] = first.split("/");
    const [ld, lm, ly] = last.split("/");
    const months = [
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
    if (fm === lm && fy === ly) {
      return `${fd}. – ${ld}. ${months[parseInt(fm) - 1]} ${fy}`;
    }
    return `${fd}.${fm}. – ${ld}.${lm}.${ly}`;
  })();

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getWeekdayLong = (date: string) => {
    const days = [
      "Sonntag",
      "Montag",
      "Dienstag",
      "Mittwoch",
      "Donnerstag",
      "Freitag",
      "Samstag",
    ];
    const [day, month, year] = date.split("/").map(Number);
    const d = new Date(year, month - 1, day);
    return days[d.getDay()];
  };

  const handleExport = () => {
    alert("Export-Funktion kommt bald!");
  };

  if (!auth.mode) {
    return (
      <div className="fullscreen-login">
        <div className="login-blur-card">
          <div className="login-brand-row">
            <div className="login-brand-icon" />
            <div className="login-brand-title">OPTIVIO</div>
          </div>
          <div className="login-brand-sub">Pfänderbahn Mitarbeiter Portal</div>

          {!showAdminPassword ? (
            <>
              <div className="login-welcome">Willkommen zurück</div>
              <div className="login-desc-white">
                Wähle deinen Namen aus, um auf deinen persönlichen Dienstplan
                zuzugreifen.
              </div>

              <div style={{ marginBottom: 6 }}>
                <label className="field-label-white">
                  Mitarbeiter auswählen
                </label>
                <select
                  className="select-transparent"
                  value={selectedEmployee}
                  onChange={(e) => {
                    setSelectedEmployee(e.target.value);
                    setLoginError("");
                  }}
                >
                  <option value="">— Bitte wählen —</option>
                  {EMPLOYEES.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                      {emp.isAdmin ? " - (BL)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {loginError && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 14px",
                    background: "rgba(220, 38, 38, 0.22)",
                    border: "1px solid rgba(254, 202, 202, 0.45)",
                    color: "#fff",
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {loginError}
                </div>
              )}

              <button
                className="btn-login-glow"
                onClick={handleEmployeeLogin}
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <>
                    <span className="loading-spinner" />
                    Anmelden...
                  </>
                ) : (
                  <>
                    Anmelden
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="login-welcome">Admin-Anmeldung 🔐</div>
              <div className="login-desc-white">
                Als Administrator ist ein Passwort erforderlich. Gib das
                Admin-Passwort ein, um den Dienstplan bearbeiten zu können.
              </div>

              <div style={{ marginBottom: 6 }}>
                <label className="field-label-white">Admin-Passwort</label>
                <input
                  type="password"
                  className="select-transparent"
                  placeholder="••••••••"
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    setLoginError("");
                  }}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleAdminPasswordSubmit()
                  }
                  autoFocus
                  style={{ paddingRight: 16 }}
                />
              </div>

              {loginError && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 14px",
                    background: "rgba(220, 38, 38, 0.22)",
                    border: "1px solid rgba(254, 202, 202, 0.45)",
                    color: "#fff",
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {loginError}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 10,
                }}
              >
                <button
                  className="btn-login-glow"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    color: "#fff",
                    boxShadow: "none",
                    border: "1px solid rgba(255,255,255,0.2)",
                    marginTop: 12,
                  }}
                  onClick={() => {
                    setShowAdminPassword(false);
                    setAdminPasswordInput("");
                    setLoginError("");
                  }}
                >
                  Zurück
                </button>
                <button
                  className="btn-login-glow"
                  onClick={handleAdminPasswordSubmit}
                >
                  Anmelden
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </>
          )}

          <div className="login-foot-white">
            © 2026 OPTIVIO • Pfänderbahn Mitarbeiter Portal
          </div>
        </div>
      </div>
    );
  }

  const todayStr = formatDate(new Date());
  const loggedInEmp = EMPLOYEES.find((e) => e.id === auth.employeeId);
  const empColors: Record<string, { bg: string; text: string }> = {
    "1": { bg: "#EF4444", text: "#fff" },
    "2": { bg: "#DC2626", text: "#fff" },
    "4": { bg: "#E11D48", text: "#fff" },
    "5": { bg: "#F59E0B", text: "#111" },
    "6": { bg: "#EAB308", text: "#111" },
    "7": { bg: "#FACC15", text: "#111" },
    "3": { bg: "#FF8C00", text: "#fff" },
    "8": { bg: "#22C55E", text: "#fff" },
    "9": { bg: "#16A34A", text: "#fff" },
    "10": { bg: "#15803D", text: "#fff" },
    "11": { bg: "#EC4899", text: "#fff" },
    "12": { bg: "#7C3AED", text: "#fff" },
    "13": { bg: "#A78BFA", text: "#fff" },
    "14": { bg: "#D97706", text: "#fff" },
    "15": { bg: "#B45309", text: "#fff" },
    "16": { bg: "#92400E", text: "#fff" },
    "17": { bg: "#0EA5E9", text: "#fff" },
  };

  const avatar = loggedInEmp
    ? empColors[loggedInEmp.id] || { bg: "#cbd5e1", text: "#0f172a" }
    : { bg: "#cbd5e1", text: "#0f172a" };

  const isBertl = auth.mode === "admin"; // Check, ob der Admin angemeldet ist

  return (
    <div className="app-layout">
      {/* 1. GEMEINSAME SIDEBAR FÜR ALLE */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Avatar emp={loggedInEmp} size={30} />
          </div>
          <span className="logo-text">OPTIVIO</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeNav === "overview" ? "active" : ""}`}
            onClick={() => setActiveNav("overview")}
          >
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
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Übersicht
          </button>

          {/* Menüpunkte nur für Mitarbeiter */}
          {!isBertl && (
            <button
              className={`nav-item ${activeNav === "krankenstand" ? "active" : ""}`}
              onClick={() => setActiveNav("krankenstand")}
            >
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
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Krankenstand
            </button>
          )}

          {/* Menüpunkte nur für Bertl (Admin) */}
          {isBertl && (
            <>
              <button
                className={`nav-item ${activeNav === "krankenbescheinigungen" ? "active" : ""}`}
                onClick={async () => {
                  setActiveNav("krankenbescheinigungen");
                  setUnreadCount(0); // Roter Punkt geht sofort weg

                  // Speichere die aktuelle Gesamtzahl als "gelesen" ab
                  const { data } = await supabase
                    .from("sick_leaves")
                    .select("id");
                  if (data) {
                    localStorage.setItem(
                      "pfanderbahn_last_seen_count",
                      data.length.toString(),
                    );
                  }
                }}
                style={{ position: "relative" }}
              >
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
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
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
                      boxShadow: "0 2px 6px rgba(239, 68, 68, 0.4)",
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                className={`nav-item ${activeNav === "team" ? "active" : ""}`}
                onClick={() => setActiveNav("team")}
              >
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
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Team
              </button>
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-divider" />
          <button
            className={`nav-item ${activeNav === "settings" ? "active" : ""}`}
            onClick={() => setActiveNav("settings")}
          >
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
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Einstellungen
          </button>
          <button className="nav-item logout" onClick={handleLogout}>
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
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Abmelden
          </button>
        </div>
      </aside>

      {/* 2. HAUPTBEREICH (Ändert sich je nach activeNav) */}
      <main
        className="main-content"
        style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}
      >
        {/* ANSICHT: HOME / MITARBEITER */}
        {activeNav === "overview" && !isBertl && (
          <>
            <div className="employee-personal-header">
              {loggedInEmp?.avatarUrl ? (
                <div
                  className="employee-personal-avatar"
                  style={{ padding: 0, background: avatar.bg }}
                >
                  <img
                    src={loggedInEmp.avatarUrl}
                    alt={loggedInEmp.name}
                    className="avatar-img"
                  />
                </div>
              ) : (
                <div
                  className="employee-personal-avatar"
                  style={{ background: avatar.bg, color: avatar.text }}
                >
                  {loggedInEmp ? getInitials(loggedInEmp.name) : "??"}
                </div>
              )}
              <div className="employee-personal-meta">
                <h2>{auth.employeeName}</h2>
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
              <div className="month-nav-optivio">
                <button
                  className="nav-arrow"
                  onClick={() => handleWeekChange(-1)}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <div className="month-display">
                  <span className="month-text">{currentWeekRange}</span>
                </div>
                <button
                  className="nav-arrow"
                  onClick={() => handleWeekChange(1)}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <button className="today-btn" onClick={handleGoToday}>
                  Heute
                </button>
              </div>
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
                    const entry = getCell(auth.employeeId!, date);
                    const ci = SHIFT_COLORS[entry.color];
                    const isFrei = entry.color === "frei" && !entry.note;
                    const isToday = date === todayStr;

                    let style: React.CSSProperties = isFrei
                      ? {
                          background: "#F2F5FA",
                          color: "#6B7385",
                          borderColor: "#E5E7EB",
                        }
                      : {
                          borderColor: ci.bg,
                          background: ci.bg + "1A",
                          color: ci.text === "#FFFFFF" ? ci.bg : ci.text,
                        };

                    return (
                      <div
                        key={date}
                        className={`emp-day-card ${isToday ? "today" : ""}`}
                      >
                        <div className="emp-day-weekday">
                          {getWeekdayLong(date).toUpperCase().slice(0, 2)}
                        </div>
                        <div className="emp-day-date">
                          {formatDateDisplay(date).split(".")[0]}.
                        </div>
                        <div className="emp-day-shift" style={style}>
                          {entry.note
                            ? entry.note
                            : isFrei
                              ? "— Frei —"
                              : ci.label}
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
                    {dates.map((date) => {
                      const isToday = date === todayStr;
                      return (
                        <div
                          key={date}
                          className={`pt-cell head-cell ${isToday ? "today" : ""}`}
                        >
                          <div className="weekday">
                            {getWeekdayLong(date).toUpperCase()}
                          </div>
                          <div className="day-date">
                            {formatDateDisplay(date).split(".")[0]}.
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {EMPLOYEES.map((e) => {
                    const isMe = e.id === auth.employeeId;
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
                          const ci = SHIFT_COLORS[entry.color];
                          const isFrei = entry.color === "frei" && !entry.note;
                          const isToday = date === todayStr;
                          let pillStyle: React.CSSProperties = {
                            fontSize: 11.5,
                            padding: "6px 8px",
                            borderRadius: 9,
                            width: "100%",
                            textAlign: "center",
                            fontWeight: 600,
                            lineHeight: 1.3,
                            border: "1px solid transparent",
                          };
                          if (!isFrei) {
                            pillStyle = {
                              ...pillStyle,
                              borderColor: ci.bg,
                              background: ci.bg + "1A",
                              color: ci.text === "#FFFFFF" ? ci.bg : ci.text,
                            };
                          } else {
                            pillStyle = {
                              ...pillStyle,
                              background: "#F2F5FA",
                              color: "#8E97A9",
                              borderColor: "#EEF0F4",
                            };
                          }
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
                              <div style={pillStyle}>
                                {entry.note
                                  ? entry.note
                                  : isFrei
                                    ? "Frei"
                                    : ci.label}
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

        {/* ANSICHT: HOME / ADMIN (Bertl) */}
        {activeNav === "overview" && isBertl && (
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
                <div className="month-nav-optivio">
                  <button
                    className="nav-arrow"
                    onClick={() => handleWeekChange(-1)}
                  >
                    {"<"}
                  </button>
                  <div className="month-display">
                    <span className="month-text">{currentWeekRange}</span>
                  </div>
                  <button
                    className="nav-arrow"
                    onClick={() => handleWeekChange(1)}
                  >
                    {">"}
                  </button>
                </div>
                <button className="btn btn-action" onClick={openNewEventModal}>
                  Event
                </button>
              </div>
            </div>

            <div className="admin-banner">
              <span>
                Als{" "}
                <strong>
                  {auth.employeeName || loggedInEmp?.name || "Berthold Martan"}
                </strong>{" "}
                angemeldet — du kannst den Dienstplan bearbeiten.
              </span>
            </div>

            <div className="timetable-card">
              <div className="timetable-wrapper-opt">
                <table className="timetable-opt">
                  <thead>
                    <tr>
                      <th className="opt-col-employee">MITARBEITER</th>
                      {dates.map((date) => (
                        <th key={date} className="opt-col-date">
                          {getWeekdayLong(date).toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {EMPLOYEES.map((emp) => (
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
                          const ci = SHIFT_COLORS[entry.color];
                          const isFrei = entry.color === "frei" && !entry.note;
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
                                <span>
                                  {entry.note
                                    ? entry.note
                                    : isFrei
                                      ? "Frei"
                                      : ci.label}
                                </span>
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

        {/* NEUE ANSICHT: KRANKENSTAND UPLOAD (Mitarbeiter) */}
        {activeNav === "krankenstand" && !isBertl && (
          <SickLeaveUpload employeeName={auth.employeeName || "Unbekannt"} />
        )}
        {/* NEUE ANSICHT: KRANKENBESCHEINIGUNGEN ÜBERSICHT (Admin/Bertl) */}
        {activeNav === "krankenbescheinigungen" && isBertl && <BertlOverview />}
      </main>

      {/* --- BESTEHENDE MODALS FÜR BEARBEITEN / EVENTS --- */}
      {editingCell && isBertl && (
        <div
          className="modal-overlay"
          onClick={() => {
            setEditingCell(null);
            setNoteInput("");
          }}
        >
          {/* ... Dein bestehender Editing-Modal Code ... */}
        </div>
      )}

      {showEventModal && isBertl && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowEventModal(false);
          }}
        >
          {/* ... Dein bestehender Event-Modal Code ... */}
        </div>
      )}
    </div>
  );
}

export default App;
