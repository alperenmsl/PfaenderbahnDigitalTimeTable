import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabaseClient";
import PageHero from "../components/PageHero";

import BIcon from "../components/BIcon";
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "application/pdf"];

type Hist = {
  id: string;
  date_from: string;
  date_to: string;
  status: "submitted" | "confirmed" | "rejected";
};

const STATUS = {
  submitted: { text: "Wird geprüft", color: "#B45309", bg: "#FFFBEB" },
  confirmed: { text: "Bestätigt", color: "#059669", bg: "#ECFDF5" },
  rejected: { text: "Abgelehnt", color: "#DC2626", bg: "#FEF2F2" },
};

const fmt = (iso: string) => iso.split("-").reverse().join(".");
const dayCount = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;
const fileSize = (n: number) =>
  n > 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1024))} KB`;

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#6B7385",
  textTransform: "uppercase",
  marginBottom: 6,
};

export default function SickLeaveUpload() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [history, setHistory] = useState<Hist[]>([]);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    ok: boolean;
  }>({
    show: false,
    message: "",
    ok: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const notify = (message: string, ok: boolean) =>
    setToast({ show: true, message, ok });

  useEffect(() => {
    if (!toast.show) return;
    const t = setTimeout(() => setToast((p) => ({ ...p, show: false })), 4500);
    return () => clearTimeout(t);
  }, [toast.show]);

  // Bildvorschau
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("absences")
      .select("id, date_from, date_to, status")
      .eq("type", "sick")
      .order("created_at", { ascending: false })
      .limit(5);
    setHistory((data ?? []) as Hist[]);
  };
  useEffect(() => {
    loadHistory();
  }, []);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!ALLOWED.includes(f.type))
      return notify("Nur JPG, PNG oder PDF erlaubt.", false);
    if (f.size > MAX_SIZE)
      return notify("Die Datei ist größer als 5 MB.", false);
    setFile(f);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !startDate || !endDate)
      return notify("Bitte Zeitraum angeben und eine Datei auswählen.", false);
    if (endDate < startDate)
      return notify("„Voraussichtlich bis“ liegt vor dem ersten Tag.", false);

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

      notify(
        "Krankenzettel erfolgreich an Bertl übermittelt. Gute Besserung!",
        true,
      );
      setStartDate("");
      setEndDate("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadHistory();
    } catch (err: any) {
      notify("Fehler beim Hochladen: " + (err.message ?? "unbekannt"), false);
    } finally {
      setIsUploading(false);
    }
  };

  const days =
    startDate && endDate && endDate >= startDate
      ? dayCount(startDate, endDate)
      : null;

  return (
    <div
      style={{
        maxWidth: 1000,
        width: "100%",
        margin: "0 auto",
        paddingTop: 20,
        position: "relative",
      }}
    >
      <PageHero
        icon={<BIcon name="hospital" size={30} />}
        title="Krankmeldung"
        subtitle="Gute Besserung! Lade deinen Krankenzettel hoch, Bertl bekommt ihn sofort."
      />

      <div className="form-layout">
        <form className="form-card" onSubmit={handleUpload}>
          <div
            style={{
              display: "flex",
              gap: 18,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <div style={{ flex: "1 1 190px" }}>
              <label style={labelStyle}>Erster Krankheitstag</label>
              <input
                type="date"
                className="opt-input"
                value={startDate}
                required
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ flex: "1 1 190px" }}>
              <label style={labelStyle}>Voraussichtlich bis</label>
              <input
                type="date"
                className="opt-input"
                value={endDate}
                min={startDate}
                required
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {days && (
            <div className="dur-chip" style={{ marginBottom: 18 }}>
              <BIcon name="calendar-week" size={14} /> {days}{" "}
              {days === 1 ? "Tag" : "Tage"}
            </div>
          )}

          <label style={labelStyle}>Krankenzettel (Foto oder Scan)</label>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => pick(e.target.files?.[0])}
          />

          {!file ? (
            <div
              className={`dropzone ${dragOver ? "over" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pick(e.dataTransfer.files?.[0]);
              }}
            >
              <div className="dz-icon">
                <BIcon name="camera" size={34} />
              </div>
              <div className="dz-title">
                Foto aufnehmen oder Datei auswählen
              </div>
              <div className="dz-sub">
                oder hierher ziehen • JPG, PNG, PDF • max. 5 MB
              </div>
            </div>
          ) : (
            <div className="file-chip">
              {preview ? (
                <img className="file-thumb" src={preview} alt="Vorschau" />
              ) : (
                <div className="file-thumb">PDF</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {file.name}
                </div>
                <div style={{ fontSize: 12.5, color: "#6B7385" }}>
                  {fileSize(file.size)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
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
                Entfernen
              </button>
            </div>
          )}

          <div
            style={{
              borderTop: "1px solid #EEF0F4",
              marginTop: 22,
              paddingTop: 20,
            }}
          >
            <button
              type="submit"
              className="btn-save"
              disabled={isUploading}
              style={{
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

        <div>
          <div className="info-card">
            <h3>So geht es weiter</h3>
            <div className="step-row">
              <span className="step-num">1</span>
              <span>Du lädst dein Foto oder deine PDF hoch.</span>
            </div>
            <div className="step-row">
              <span className="step-num">2</span>
              <span>Bertl prüft die Meldung und bestätigt sie.</span>
            </div>
            <div className="step-row">
              <span className="step-num">3</span>
              <span>Dein Krankenstand wird im Dienstplan eingetragen.</span>
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 12.5,
                color: "#6B7385",
                background: "#F4F8FF",
                borderRadius: 10,
                padding: "8px 12px",
              }}
            >
              <BIcon name="lock" size={13} /> Dein Krankenzettel ist nur für
              dich und Bertl sichtbar.
            </div>
          </div>

          <div className="info-card">
            <h3>Meine letzten Meldungen</h3>
            {history.length === 0 ? (
              <div style={{ color: "#8E97A9", fontSize: 13.5 }}>
                Noch keine Meldungen.
              </div>
            ) : (
              history.map((h) => {
                const s = STATUS[h.status];
                return (
                  <div key={h.id} className="hist-row">
                    <span style={{ fontWeight: 600 }}>
                      {fmt(h.date_from)} – {fmt(h.date_to)}
                    </span>
                    <span
                      className="status-pill"
                      style={{ background: s.bg, color: s.color }}
                    >
                      {s.text}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {toast.show && (
        <div
          style={{
            position: "fixed",
            bottom: 30,
            right: 30,
            zIndex: 9999,
            minWidth: 300,
            maxWidth: "90vw",
            background: toast.ok ? "#10B981" : "#DC2626",
            color: "#fff",
            padding: "16px 22px",
            borderRadius: 14,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            animation: "slideInRight 0.3s ease-out",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <BIcon
              name={
                toast.ok ? "check-circle-fill" : "exclamation-triangle-fill"
              }
              size={20}
            />
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
              animation: "shrinkBar 4.5s linear forwards",
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
