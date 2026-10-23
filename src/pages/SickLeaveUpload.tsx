import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabaseClient";

type Props = {
  employeeName: string;
};

export default function SickLeaveUpload({ employeeName }: Props) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // State für die Toast-Nachricht
  const [toast, setToast] = useState<{ show: boolean; message: string }>({
    show: false,
    message: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast automatisch nach 4 Sekunden ausblenden
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !startDate || !endDate) {
      alert("Bitte alle Felder ausfüllen!");
      return;
    }
    if (!employeeName) {
      alert("Mitarbeitername fehlt!");
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${employeeName.replace(/\s+/g, "_")}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("sick-leaves")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("sick-leaves")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("sick_leaves").insert([
        {
          employee_name: employeeName,
          start_date: startDate,
          end_date: endDate,
          image_url: publicUrlData.publicUrl,
        },
      ]);

      if (dbError) throw dbError;

      // Erfolgreich! Zeige unsere schicke Toast-Nachricht
      setToast({
        show: true,
        message: "Krankenzettel erfolgreich an Bertl übermittelt",
      });

      // Formular zurücksetzen
      setStartDate("");
      setEndDate("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: any) {
      console.error("Upload Fehler:", error);
      alert("Fehler beim Hochladen: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 800,
        width: "100%",
        margin: "0 auto",
        paddingTop: 20,
        position: "relative",
      }}
    >
      <div className="page-header" style={{ marginBottom: 30 }}>
        <div className="page-title-section">
          <h1 className="page-title">
            <span className="brand-blue">Krankenstand</span>
            <span className="brand-divider"> - </span>
            <span className="brand-rest">Meldung</span>
          </h1>
          <p className="page-subtitle">
            Reiche hier deine Arbeitsunfähigkeitsbescheinigung digital ein.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleUpload}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "30px",
          border: "1px solid #EEF0F4",
          boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 20,
            marginBottom: 25,
            flexWrap: "wrap",
          }}
        >
          <div className="form-group" style={{ flex: "1 1 200px" }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#6B7385",
                textTransform: "uppercase",
              }}
            >
              Erster Krankheitstag
            </label>
            <input
              type="date"
              className="opt-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ marginTop: 6 }}
              required
            />
          </div>
          <div className="form-group" style={{ flex: "1 1 200px" }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#6B7385",
                textTransform: "uppercase",
              }}
            >
              Voraussichtlich bis
            </label>
            <input
              type="date"
              className="opt-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ marginTop: 6 }}
              required
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 35 }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#6B7385",
              textTransform: "uppercase",
            }}
          >
            Krankenzettel (Foto/Scan)
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 15,
              marginTop: 8,
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept="image/*,.pdf"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              className="btn-action"
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: "10px 20px", borderRadius: 8, margin: 0 }}
            >
              Datei auswählen
            </button>
            <span
              style={{
                fontSize: 13,
                color: "#6B7385",
                background: "#F8FAFF",
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #E6EEFF",
              }}
            >
              {file ? (
                <span style={{ color: "#165DFF", fontWeight: 600 }}>
                  {file.name}
                </span>
              ) : (
                "Keine Datei (JPG, PNG, PDF)"
              )}
            </span>
          </div>
        </div>

        <div
          style={{
            borderTop: "1px solid #EEF0F4",
            paddingTop: 20,
            display: "flex",
          }}
        >
          <button
            type="submit"
            className="btn-save"
            disabled={isUploading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 28px",
              fontSize: 15,
              borderRadius: 99,
              opacity: isUploading ? 0.7 : 1,
            }}
          >
            {isUploading ? "Lädt hoch..." : "Krankenstand übermitteln"}
          </button>
        </div>
      </form>

      {/* --- SCHICKE GRÜNE TOAST-BENACHRICHTIGUNG RECHTS UNTEN --- */}
      {toast.show && (
        <div
          style={{
            position: "fixed",
            bottom: 30,
            right: 30,
            background: "#10B981",
            color: "#fff",
            padding: "16px 22px",
            borderRadius: 14,
            boxShadow: "0 10px 30px rgba(16, 185, 129, 0.3)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            zIndex: 9999,
            minWidth: 320,
            animation: "slideInRight 0.3s ease-out",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              {toast.message}
            </span>
          </div>

          {/* Der weiße Ladebalken ganz unten, der sich nach links entleert */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              height: 3,
              background: "rgba(255, 255, 255, 0.8)",
              width: "100%",
              animation: "shrinkBar 4s linear forwards",
            }}
          />

          {/* CSS Animationen */}
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100px); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
            @keyframes shrinkBar {
              from { width: 100%; }
              to { width: 0%; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
