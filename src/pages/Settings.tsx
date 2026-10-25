import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { SHIFT_COLORS } from "../data";
import type { ShiftColor } from "../types";

import BIcon from "../components/BIcon";
type Props = {
  userId: string;
  fullName: string;
  isPlanner: boolean;
  avatarUrl?: string;
};

type Row = { date: string; shift_color: string; note: string | null };

const NOT_WORK = ["frei", "krank", "urlaub", "feiertag"];
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

const pad = (n: number) => String(n).padStart(2, "0");
const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#6B7385",
  textTransform: "uppercase",
  marginBottom: 6,
};
const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 20,
  padding: 24,
  border: "1px solid #E6EDF8",
  boxShadow: "0 10px 34px rgba(15,60,130,0.06)",
  marginBottom: 20,
};

export default function Settings({
  userId,
  fullName,
  isPlanner,
  avatarUrl,
}: Props) {
  const now = new Date();
  const year = now.getFullYear();
  const monthKey = `${year}-${pad(now.getMonth() + 1)}`;

  const [rows, setRows] = useState<Row[] | null>(null);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pwBusy, setPwBusy] = useState(false);
  const [icsBusy, setIcsBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("schedule_published")
      .select("date, shift_color, note")
      .eq("employee_id", userId)
      .gte("date", `${year}-01-01`)
      .lte("date", `${year}-12-31`)
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [userId, year]);

  const isWork = (r: Row) => !NOT_WORK.includes(r.shift_color);
  const inNext7 = (r: Row) => {
    const t = isoLocal(now);
    const end = new Date(now);
    end.setDate(end.getDate() + 6);
    return r.date >= t && r.date <= isoLocal(end);
  };

  const stats = rows && [
    {
      label: `Dienste im ${MONTHS[now.getMonth()]}`,
      value: rows.filter((r) => r.date.startsWith(monthKey) && isWork(r))
        .length,
      color: "#0A4FA8",
    },
    {
      label: "Dienste in den nächsten 7 Tagen",
      value: rows.filter((r) => inNext7(r) && isWork(r)).length,
      color: "#059669",
    },
    {
      label: `Urlaubstage ${year}`,
      value: rows.filter((r) => r.shift_color === "urlaub").length,
      color: "#D97706",
    },
    {
      label: `Krankheitstage ${year}`,
      value: rows.filter((r) => r.shift_color === "krank").length,
      color: "#6B7385",
    },
  ];

  /* --- Kalender-Export (.ics) --- */
  const exportIcs = async () => {
    setIcsBusy(true);
    const { data, error } = await supabase
      .from("schedule_published")
      .select("date, shift_color, note")
      .eq("employee_id", userId)
      .gte("date", isoLocal(now))
      .order("date")
      .limit(400);
    setIcsBusy(false);
    if (error) return alert("Export fehlgeschlagen: " + error.message);

    const list = ((data ?? []) as Row[]).filter(
      (r) => r.shift_color !== "frei" && r.shift_color !== "krank",
    );
    if (list.length === 0)
      return alert(
        "Es sind keine veröffentlichten Dienste zum Exportieren vorhanden.",
      );

    const esc = (s: string) =>
      s.replace(/([\\,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Pfaenderbahn//Dienstplan//DE",
      "CALSCALE:GREGORIAN",
      "X-WR-CALNAME:Pfänderbahn Dienstplan",
    ];
    list.forEach((r) => {
      const [y, m, d] = r.date.split("-").map(Number);
      const next = new Date(Date.UTC(y, m - 1, d + 1))
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
      const label =
        r.note ||
        SHIFT_COLORS[r.shift_color as ShiftColor]?.label ||
        r.shift_color;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${r.date}-${userId}@pfaenderbahn`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${r.date.replace(/-/g, "")}`,
        `DTEND;VALUE=DATE:${next}`,
        `SUMMARY:${esc("Pfänderbahn: " + label)}`,
        "END:VEVENT",
      );
    });
    lines.push("END:VCALENDAR");

    const blob = new Blob([lines.join("\r\n")], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pfaenderbahn-dienstplan.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  /* --- PIN ändern --- */
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (pw1.length < 6)
      return setPwMsg({ ok: false, text: "Mindestens 6 Zeichen." });
    if (pw1 !== pw2)
      return setPwMsg({
        ok: false,
        text: "Die beiden Eingaben stimmen nicht überein.",
      });
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setPwBusy(false);
    if (error) return setPwMsg({ ok: false, text: error.message });
    setPw1("");
    setPw2("");
    setPwMsg({ ok: true, text: "PIN wurde geändert." });
  };

  return (
    <div
      style={{ maxWidth: 760, width: "100%", margin: "0 auto", paddingTop: 20 }}
    >
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-title-section">
          <h1 className="page-title">
            <span className="brand-blue">Mein</span> Profil
          </h1>
          <p className="page-subtitle">
            Deine Kennzahlen, Kalender-Export und Sicherheit.
          </p>
        </div>
      </div>

      {/* Profil */}
      <div
        style={{
          ...cardStyle,
          display: "flex",
          alignItems: "center",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div
          className="hero-avatar"
          style={{ width: 72, height: 72, borderColor: "#E3ECFB" }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} />
          ) : (
            fullName
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
          )}
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{fullName}</div>
          <span
            style={{
              display: "inline-block",
              marginTop: 6,
              padding: "3px 12px",
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 700,
              background: isPlanner ? "#FEF3C7" : "#EAF2FF",
              color: isPlanner ? "#92400E" : "#0A4FA8",
            }}
          >
            {isPlanner ? "★ Betriebsleiter / Planer" : "Mitarbeiter"}
          </span>
        </div>
      </div>

      {/* Kennzahlen */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {(stats ?? [null, null, null, null]).map((s, i) => (
          <div key={i} className="stat-card" style={{ cursor: "default" }}>
            <div className="stat-value" style={{ color: s?.color }}>
              {s ? s.value : "–"}
            </div>
            <div className="stat-label">{s ? s.label : "Lade…"}</div>
          </div>
        ))}
      </div>

      {/* Kalender-Export */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
          <BIcon name="calendar-event" size={16} /> In den Handy-Kalender
          übernehmen
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "#6B7385",
            marginBottom: 14,
            lineHeight: 1.5,
          }}
        >
          Lädt alle veröffentlichten Dienste ab heute als Kalenderdatei (.ics)
          herunter. Sie funktioniert mit Google Kalender, Apple Kalender und
          Outlook. Der Export ist eine Momentaufnahme: Nach neuen
          Veröffentlichungen musst du ihn erneut herunterladen.
        </p>
        <button
          className="btn-action"
          onClick={exportIcs}
          disabled={icsBusy}
          style={{
            padding: "10px 22px",
            borderRadius: 99,
            margin: 0,
            opacity: icsBusy ? 0.6 : 1,
          }}
        >
          {icsBusy ? "Wird erstellt…" : "Kalenderdatei herunterladen"}
        </button>
      </div>

      {/* PIN */}
      <form onSubmit={changePw} style={cardStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>
          <BIcon name="lock" size={16} /> PIN / Passwort ändern
        </h3>
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div style={{ flex: "1 1 220px" }}>
            <label style={labelStyle}>Neue PIN</label>
            <input
              type="password"
              className="opt-input"
              autoComplete="new-password"
              value={pw1}
              onChange={(e) => {
                setPw1(e.target.value);
                setPwMsg(null);
              }}
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ flex: "1 1 220px" }}>
            <label style={labelStyle}>PIN wiederholen</label>
            <input
              type="password"
              className="opt-input"
              autoComplete="new-password"
              value={pw2}
              onChange={(e) => {
                setPw2(e.target.value);
                setPwMsg(null);
              }}
              style={{ width: "100%" }}
            />
          </div>
        </div>
        <button
          type="submit"
          className="btn-save"
          disabled={pwBusy}
          style={{
            padding: "10px 24px",
            borderRadius: 99,
            opacity: pwBusy ? 0.6 : 1,
          }}
        >
          {pwBusy ? "Wird gespeichert…" : "PIN ändern"}
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
  );
}
