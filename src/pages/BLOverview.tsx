import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

type SickLeaveRecord = {
  id: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  image_url: string;
  created_at: string;
};

type Props = {
  onClearBadge?: () => void;
};

export default function BLOverview({ onClearBadge }: Props) {
  const [records, setRecords] = useState<SickLeaveRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSickLeaves();
    if (onClearBadge) {
      onClearBadge(); // Setzt den Zähler sicher auf 0, falls vorhanden
    }
  }, []);

  const fetchSickLeaves = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("sick_leaves")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fehler beim Laden:", error);
    } else {
      setRecords(data || []);
    }
    setIsLoading(false);
  };

  const currentSeen = localStorage.getItem("pfanderbahn_last_seen_count");
  if (currentSeen) {
    const newCount = Math.max(0, parseInt(currentSeen, 10) - 1);
    localStorage.setItem("pfanderbahn_last_seen_count", newCount.toString());
  }

  const handleDelete = async (id: string, imageUrl: string) => {
    if (!confirm("Möchtest du diesen Krankenzettel wirklich löschen?")) return;

    try {
      const { error: dbError } = await supabase
        .from("sick_leaves")
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;

      const urlParts = imageUrl.split("/sick-leaves/");
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from("sick-leaves").remove([filePath]);
      }

      setRecords((prev) => prev.filter((r) => r.id !== id));
      alert("Krankenzettel erfolgreich gelöscht!");
    } catch (err: any) {
      console.error("Fehler beim Löschen:", err);
      alert("Fehler beim Löschen: " + err.message);
    }
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
          <div style={{ textAlign: "center", padding: "40px" }}>
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
              Aktuell liegen keine neuen Krankenbescheinigungen vor.
            </span>
          </div>
        ) : (
          records.map((record) => (
            <div
              key={record.id}
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
                  cursor: "pointer",
                }}
                onClick={() => window.open(record.image_url, "_blank")}
                title="Bild vergrößern"
              >
                <img
                  src={record.image_url}
                  alt={`Krankenzettel von ${record.employee_name}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
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
                  {record.employee_name}
                </h3>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
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
                  <span style={{ color: "#165DFF" }}>Zeitraum:</span>{" "}
                  {record.start_date} bis {record.end_date}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  className="btn-action"
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                  onClick={() => window.open(record.image_url, "_blank")}
                >
                  Vollbild ansehen
                </button>

                <button
                  onClick={() => handleDelete(record.id, record.image_url)}
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
