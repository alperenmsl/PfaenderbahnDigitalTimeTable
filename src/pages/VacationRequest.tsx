import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import PageHero from "../components/PageHero";

import BIcon from "../components/BIcon";
type Row = {
  id: string;
  date_from: string;
  date_to: string;
  note: string | null;
  status: "submitted" | "confirmed" | "rejected";
};

const fmt = (iso: string) => iso.split("-").reverse().join(".");
const dayCount = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;

const STATUS = {
  submitted: {
    text: "Wartet auf Genehmigung",
    color: "#B45309",
    bg: "#FFFBEB",
  },
  confirmed: { text: "Genehmigt", color: "#059669", bg: "#ECFDF5" },
  rejected: { text: "Abgelehnt", color: "#DC2626", bg: "#FEF2F2" },
};
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#6B7385",
  textTransform: "uppercase",
  marginBottom: 6,
};

export default function VacationRequest() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("absences")
      .select("id, date_from, date_to, note, status")
      .eq("type", "vacation")
      .order("date_from", { ascending: false });
    setRows((data ?? []) as Row[]);
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!from || !to)
      return setMsg({ ok: false, text: "Bitte beide Daten angeben." });
    if (to < from)
      return setMsg({ ok: false, text: "Das Ende liegt vor dem Beginn." });
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return setMsg({ ok: false, text: "Nicht eingeloggt." });
    }
    const { error } = await supabase.from("absences").insert({
      employee_id: user.id,
      type: "vacation",
      date_from: from,
      date_to: to,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: "Urlaubsantrag wurde an Bertl gesendet." });
    setFrom("");
    setTo("");
    setNote("");
    load();
  };

  const withdraw = async (id: string) => {
    if (!window.confirm("Antrag wirklich zurückziehen?")) return;
    const { error } = await supabase.from("absences").delete().eq("id", id);
    if (error) return alert("Fehler: " + error.message);
    load();
  };

  const days = from && to && to >= from ? dayCount(from, to) : null;
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = rows.filter(
    (r) => r.status === "confirmed" && r.date_to >= todayIso,
  );

  return (
    <div
      style={{
        maxWidth: 1000,
        width: "100%",
        margin: "0 auto",
        paddingTop: 20,
      }}
    >
      <PageHero
        variant="sun"
        icon={<BIcon name="sun" size={30} />}
        title="Urlaubsantrag"
        subtitle="Plane deinen Urlaub, Bertl genehmigt ihn und trägt ihn im Dienstplan ein."
      />

      <div className="form-layout">
        <form className="form-card" onSubmit={submit}>
          <div
            style={{
              display: "flex",
              gap: 18,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <div style={{ flex: "1 1 190px" }}>
              <label style={labelStyle}>Von</label>
              <input
                type="date"
                className="opt-input"
                value={from}
                required
                onChange={(e) => setFrom(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ flex: "1 1 190px" }}>
              <label style={labelStyle}>Bis (inklusive)</label>
              <input
                type="date"
                className="opt-input"
                value={to}
                min={from}
                required
                onChange={(e) => setTo(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {days && (
            <div
              className="dur-chip"
              style={{
                marginBottom: 18,
                background: "#FEF3C7",
                color: "#92400E",
              }}
            >
              <BIcon name="sun" size={14} /> {days}{" "}
              {days === 1 ? "Tag" : "Tage"} Urlaub
            </div>
          )}

          <label style={labelStyle}>Anmerkung (optional)</label>
          <input
            className="opt-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="z. B. Familienurlaub"
            style={{ width: "100%", marginBottom: 20 }}
          />

          <div style={{ borderTop: "1px solid #EEF0F4", paddingTop: 20 }}>
            <button
              type="submit"
              className="btn-save"
              disabled={busy}
              style={{
                padding: "12px 28px",
                borderRadius: 99,
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? "Wird gesendet..." : "Urlaub beantragen"}
            </button>
            {msg && (
              <p
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  color: msg.ok ? "#059669" : "#DC2626",
                }}
              >
                {msg.text}
              </p>
            )}
          </div>
        </form>

        <div>
          {upcoming.length > 0 && (
            <div
              className="info-card"
              style={{
                background: "linear-gradient(135deg,#FFFBEB,#FFF)",
                borderColor: "#FDE68A",
              }}
            >
              <h3>
                <BIcon name="sun" size={15} /> Dein nächster Urlaub
              </h3>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#92400E" }}>
                {fmt(upcoming[upcoming.length - 1].date_from)} –{" "}
                {fmt(upcoming[upcoming.length - 1].date_to)}
              </div>
            </div>
          )}

          <div className="info-card">
            <h3>So geht es weiter</h3>
            <div className="step-row">
              <span className="step-num">1</span>
              <span>Du reichst den Antrag mit Zeitraum ein.</span>
            </div>
            <div className="step-row">
              <span className="step-num">2</span>
              <span>Bertl genehmigt oder lehnt ab.</span>
            </div>
            <div className="step-row">
              <span className="step-num">3</span>
              <span>Genehmigter Urlaub erscheint im Dienstplan.</span>
            </div>
          </div>

          <div className="info-card">
            <h3>Meine Anträge</h3>
            {rows.length === 0 ? (
              <div style={{ color: "#8E97A9", fontSize: 13.5 }}>
                Noch keine Anträge.
              </div>
            ) : (
              rows.map((r) => {
                const s = STATUS[r.status];
                return (
                  <div
                    key={r.id}
                    className="hist-row"
                    style={{ flexWrap: "wrap" }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {fmt(r.date_from)} – {fmt(r.date_to)}
                      </div>
                      {r.note && (
                        <div style={{ fontSize: 12, color: "#6B7385" }}>
                          {r.note}
                        </div>
                      )}
                    </div>
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <span
                        className="status-pill"
                        style={{ background: s.bg, color: s.color }}
                      >
                        {s.text}
                      </span>
                      {r.status === "submitted" && (
                        <button
                          onClick={() => withdraw(r.id)}
                          style={{
                            background: "#FEF2F2",
                            color: "#DC2626",
                            border: "1px solid #FECACA",
                            padding: "3px 9px",
                            borderRadius: 8,
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Zurückziehen
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
