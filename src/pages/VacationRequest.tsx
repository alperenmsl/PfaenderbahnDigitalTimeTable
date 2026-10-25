import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

type Row = {
  id: string;
  date_from: string;
  date_to: string;
  note: string | null;
  status: "submitted" | "confirmed" | "rejected";
};

const fmt = (iso: string) => iso.split("-").reverse().join(".");
const STATUS = {
  submitted: {
    text: "Wartet auf Genehmigung",
    color: "#D97706",
    bg: "#FFFBEB",
  },
  confirmed: { text: "Genehmigt", color: "#059669", bg: "#ECFDF5" },
  rejected: { text: "Abgelehnt", color: "#DC2626", bg: "#FEF2F2" },
};
const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#6B7385",
  textTransform: "uppercase",
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

  return (
    <div
      style={{ maxWidth: 800, width: "100%", margin: "0 auto", paddingTop: 20 }}
    >
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-title-section">
          <h1 className="page-title">
            <span className="brand-blue">Urlaub</span>
            <span className="brand-divider"> - </span>
            <span className="brand-rest">Antrag</span>
          </h1>
          <p className="page-subtitle">
            Beantrage deinen Urlaub, Bertl genehmigt ihn.
          </p>
        </div>
      </div>

      <form
        onSubmit={submit}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 28,
          border: "1px solid #EEF0F4",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div style={{ flex: "1 1 180px" }}>
            <label style={labelStyle}>Von</label>
            <input
              type="date"
              className="opt-input"
              value={from}
              required
              onChange={(e) => setFrom(e.target.value)}
              style={{ marginTop: 6, width: "100%" }}
            />
          </div>
          <div style={{ flex: "1 1 180px" }}>
            <label style={labelStyle}>Bis (inklusive)</label>
            <input
              type="date"
              className="opt-input"
              value={to}
              min={from}
              required
              onChange={(e) => setTo(e.target.value)}
              style={{ marginTop: 6, width: "100%" }}
            />
          </div>
        </div>
        <label style={labelStyle}>Anmerkung (optional)</label>
        <input
          className="opt-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="z. B. Familienurlaub"
          style={{ marginTop: 6, marginBottom: 20, width: "100%" }}
        />
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
      </form>

      <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>
        Meine Anträge
      </h3>
      {rows.length === 0 ? (
        <div style={{ color: "#6B7385", fontSize: 14 }}>
          Noch keine Anträge.
        </div>
      ) : (
        rows.map((r) => {
          const s = STATUS[r.status];
          return (
            <div
              key={r.id}
              style={{
                background: "#fff",
                border: "1px solid #EEF0F4",
                borderRadius: 14,
                padding: "14px 18px",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: "1 1 200px" }}>
                <div style={{ fontWeight: 800 }}>
                  {fmt(r.date_from)} – {fmt(r.date_to)}
                </div>
                {r.note && (
                  <div style={{ fontSize: 13, color: "#6B7385", marginTop: 2 }}>
                    {r.note}
                  </div>
                )}
              </div>
              <span
                style={{
                  background: s.bg,
                  color: s.color,
                  padding: "5px 12px",
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 700,
                }}
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
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Zurückziehen
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
