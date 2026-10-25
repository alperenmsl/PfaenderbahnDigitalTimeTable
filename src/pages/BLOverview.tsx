import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

type Record_ = {
  id: string;
  date_from: string;
  date_to: string;
  file_path: string | null;
  status: "submitted" | "confirmed" | "rejected";
  created_at: string;
  profiles: { full_name: string } | null;
  url?: string;
};

type Props = { onChange?: () => void };

const fmt = (iso: string) => iso.split("-").reverse().join(".");
const isPdf = (p: string | null) => !!p && p.toLowerCase().endsWith(".pdf");

export default function BLOverview({ onChange }: Props) {
  const [records, setRecords] = useState<Record_[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("absences")
      .select(
        "id, date_from, date_to, file_path, status, created_at, profiles:employee_id(full_name)",
      )
      .eq("type", "sick")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fehler beim Laden:", error);
      setIsLoading(false);
      return;
    }
    const rows = (data ?? []) as unknown as Record_[];

    const paths = rows.map((r) => r.file_path).filter(Boolean) as string[];
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from("sick-notes")
        .createSignedUrls(paths, 3600);
      signed?.forEach((s) => {
        const row = rows.find((r) => r.file_path === s.path);
        if (row && s.signedUrl) row.url = s.signedUrl;
      });
    }
    setRecords(rows);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const confirm_ = async (id: string) => {
    const { error } = await supabase.rpc("set_absence_status", {
      p_id: id,
      p_status: "confirmed",
    });
    if (error) return alert("Fehler: " + error.message);
    setRecords((p) =>
      p.map((r) => (r.id === id ? { ...r, status: "confirmed" } : r)),
    );
    onChange?.();
  };

  const handleDelete = async (r: Record_) => {
    if (!window.confirm("Möchtest du diese Meldung wirklich löschen?")) return;
    const { error } = await supabase.from("absences").delete().eq("id", r.id);
    if (error) return alert("Fehler beim Löschen: " + error.message);
    if (r.file_path)
      await supabase.storage.from("sick-notes").remove([r.file_path]);
    setRecords((p) => p.filter((x) => x.id !== r.id));
    onChange?.();
  };

  return (
    <div
      style={{
        maxWidth: 1000,
        width: "100%",
        margin: "0 auto",
        paddingTop: 20,
      }}
    >
      <div className="page-header" style={{ marginBottom: 30 }}>
        <div className="page-title-section">
          <h1 className="page-title">
            <span className="brand-blue">Eingereichte</span>
            <span className="brand-divider"> - </span>
            <span className="brand-rest">Bescheinigungen</span>
          </h1>
          <p className="page-subtitle">
            Übersicht aller hochgeladenen Krankenzettel der Mitarbeiter.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            Lade Bescheinigungen...
          </div>
        ) : records.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #EEF0F4",
            }}
          >
            <span style={{ fontSize: 15, color: "#6B7385", fontWeight: 600 }}>
              Aktuell liegen keine Krankenbescheinigungen vor.
            </span>
          </div>
        ) : (
          records.map((r) => (
            <div
              key={r.id}
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: 24,
                border: "1px solid #EEF0F4",
                boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
                display: "flex",
                gap: 24,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#F8FAFF",
                  border: "1px solid #E6EEFF",
                  flexShrink: 0,
                  cursor: r.url ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  color: "#165DFF",
                }}
                onClick={() => r.url && window.open(r.url, "_blank")}
              >
                {r.url && !isPdf(r.file_path) ? (
                  <img
                    src={r.url}
                    alt={`Krankenzettel von ${r.profiles?.full_name}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  "PDF"
                )}
              </div>

              <div style={{ flex: "1 1 250px" }}>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#0F172A",
                    marginBottom: 10,
                  }}
                >
                  {r.profiles?.full_name ?? "Unbekannt"}
                </h3>
                <div
                  style={{
                    display: "inline-flex",
                    gap: 8,
                    background: "#F8FAFF",
                    border: "1px solid #E6EEFF",
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#6B7385",
                    fontWeight: 600,
                  }}
                >
                  <span style={{ color: "#165DFF" }}>Zeitraum:</span>
                  {fmt(r.date_from)} bis {fmt(r.date_to)}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    color: r.status === "confirmed" ? "#059669" : "#D97706",
                  }}
                >
                  {r.status === "confirmed"
                    ? "✓ Bestätigt – im Dienstplan als Krank eingetragen"
                    : "● Neu eingereicht"}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                {r.url && (
                  <button
                    className="btn-action"
                    style={{
                      padding: "10px 20px",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                    onClick={() => window.open(r.url, "_blank")}
                  >
                    Ansehen
                  </button>
                )}
                {r.status !== "confirmed" && (
                  <button
                    onClick={() => confirm_(r.id)}
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
                    Bestätigen
                  </button>
                )}
                <button
                  onClick={() => handleDelete(r)}
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
                  Löschen
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
