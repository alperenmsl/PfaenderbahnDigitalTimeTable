import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabaseClient";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "application/pdf"];

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#6B7385",
  textTransform: "uppercase",
};

export default function SickLeaveUpload() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    ok: boolean;
  }>({ show: false, message: "", ok: true });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!toast.show) return;
    const t = setTimeout(() => setToast((p) => ({ ...p, show: false })), 4000);
    return () => clearTimeout(t);
  }, [toast.show]);

  const notify = (message: string, ok: boolean) =>
    setToast({ show: true, message, ok });

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !startDate || !endDate)
      return notify("Bitte alle Felder ausfüllen.", false);
    if (endDate < startDate)
      return notify("„Voraussichtlich bis“ liegt vor dem ersten Tag.", false);
    if (!ALLOWED.includes(file.type))
      return notify("Nur JPG, PNG oder PDF erlaubt.", false);
    if (file.size > MAX_SIZE)
      return notify("Die Datei ist größer als 5 MB.", false);

    setIsUploading(true);
    let filePath: string | null = null;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht eingeloggt.");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      filePath = `${user.id}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("sick-notes")
        .upload(filePath, file);
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("absences").insert({
        employee_id: user.id,
        type: "sick",
        date_from: startDate,
        date_to: endDate,
        file_path: filePath,
      });
      if (dbErr) {
        await supabase.storage.from("sick-notes").remove([filePath]);
        throw dbErr;
      }

      notify("Krankenzettel erfolgreich an Bertl übermittelt", true);
      setStartDate("");
      setEndDate("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      notify("Fehler beim Hochladen: " + (err.message ?? "unbekannt"), false);
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
          padding: 30,
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
            <label style={labelStyle}>Erster Krankheitstag</label>
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
            <label style={labelStyle}>Voraussichtlich bis</label>
            <input
              type="date"
              className="opt-input"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ marginTop: 6 }}
              required
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 35 }}>
          <label style={labelStyle}>Krankenzettel (Foto/Scan)</label>
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
              accept="image/jpeg,image/png,application/pdf"
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
                "Keine Datei (JPG, PNG, PDF, max. 5 MB)"
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

      {toast.show && (
        <div
          style={{
            position: "fixed",
            bottom: 30,
            right: 30,
            background: toast.ok ? "#10B981" : "#DC2626",
            color: "#fff",
            padding: "16px 22px",
            borderRadius: 14,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            zIndex: 9999,
            minWidth: 320,
            animation: "slideInRight 0.3s ease-out",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>{toast.ok ? "✅" : "⚠️"}</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              {toast.message}
            </span>
          </div>
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              height: 3,
              background: "rgba(255,255,255,0.8)",
              width: "100%",
              animation: "shrinkBar 4s linear forwards",
            }}
          />
          <style>{`
            @keyframes slideInRight { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes shrinkBar { from { width: 100%; } to { width: 0%; } }
          `}</style>
        </div>
      )}
    </div>
  );
}
