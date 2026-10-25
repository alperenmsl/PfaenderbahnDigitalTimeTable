import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

type Row = {
  id: string;
  employee_id: string;
  date_from: string;
  date_to: string;
  note: string | null;
  status: "submitted" | "confirmed" | "rejected";
  profiles: { full_name: string } | null;
};

type Props = { onChange?: () => void };

const fmt = (iso: string) => iso.split("-").reverse().join(".");
const ORDER = { submitted: 0, confirmed: 1, rejected: 2 };
const STATUS = {
  submitted: { text: "Offen", color: "#D97706", bg: "#FFFBEB" },
  confirmed: { text: "Genehmigt", color: "#059669", bg: "#ECFDF5" },
  rejected: { text: "Abgelehnt", color: "#DC2626", bg: "#FEF2F2" },
};

export default function VacationAdmin({ onChange }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("absences")
      .select(
        "id, employee_id, date_from, date_to, note, status, profiles:employee_id(full_name)",
      )
      .eq("type", "vacation");
    if (error) console.error(error);
    const list = ((data ?? []) as unknown as Row[]).sort(
      (a, b) =>
        ORDER[a.status] - ORDER[b.status] ||
        a.date_from.localeCompare(b.date_from),
    );
    setRows(list);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const setStatus = async (id: string, status: "confirmed" | "rejected") => {
    setBusyId(id);
    const { error } = await supabase.rpc("set_absence_status", {
      p_id: id,
      p_status: status,
    });
    setBusyId(null);
    if (error) return alert("Fehler: " + error.message);
    await load();
    onChange?.();
  };

  // Wer ist im selben Zeitraum schon genehmigt im Urlaub?
  const overlaps = (r: Row) =>
    rows
      .filter(
        (o) =>
          o.id !== r.id &&
          o.status === "confirmed" &&
          o.date_from <= r.date_to &&
          o.date_to >= r.date_from,
      )
      .map((o) => o.profiles?.full_name ?? "?");

  return (
    <div
      style={{
        maxWidth: 1000,
        width: "100%",
        margin: "0 auto",
        paddingTop: 20,
      }}
    >
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-title-section">
          <h1 className="page-title">
            <span className="brand-blue">Urlaubs</span>
            <span className="brand-rest">anträge</span>
          </h1>
          <p className="page-subtitle">
            Genehmigte Urlaube werden automatisch im Dienstplan eingetragen.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>Lade Anträge...</div>
      ) : rows.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #EEF0F4",
            color: "#6B7385",
            fontWeight: 600,
          }}
        >
          Keine Urlaubsanträge vorhanden.
        </div>
      ) : (
        rows.map((r) => {
          const s = STATUS[r.status];
          const others = r.status === "submitted" ? overlaps(r) : [];
          return (
            <div
              key={r.id}
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: 20,
                border: "1px solid #EEF0F4",
                marginBottom: 14,
                display: "flex",
                gap: 20,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: "1 1 260px" }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>
                  {r.profiles?.full_name ?? "Unbekannt"}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "#165DFF",
                    fontWeight: 700,
                    marginTop: 4,
                  }}
                >
                  {fmt(r.date_from)} – {fmt(r.date_to)}
                </div>
                {r.note && (
                  <div style={{ fontSize: 13, color: "#6B7385", marginTop: 4 }}>
                    {r.note}
                  </div>
                )}
                {others.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#92400E",
                      background: "#FEF3C7",
                      padding: "6px 10px",
                      borderRadius: 8,
                      display: "inline-block",
                    }}
                  >
                    ⚠ Zeitgleich im Urlaub: {others.join(", ")}
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
              <div style={{ display: "flex", gap: 10 }}>
                {r.status !== "confirmed" && (
                  <button
                    disabled={busyId === r.id}
                    onClick={() => setStatus(r.id, "confirmed")}
                    style={{
                      background: "#ECFDF5",
                      color: "#059669",
                      border: "1px solid #A7F3D0",
                      padding: "10px 16px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Genehmigen
                  </button>
                )}
                {r.status !== "rejected" && (
                  <button
                    disabled={busyId === r.id}
                    onClick={() => setStatus(r.id, "rejected")}
                    style={{
                      background: "#FEF2F2",
                      color: "#DC2626",
                      border: "1px solid #FECACA",
                      padding: "10px 16px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {r.status === "confirmed" ? "Widerrufen" : "Ablehnen"}
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
