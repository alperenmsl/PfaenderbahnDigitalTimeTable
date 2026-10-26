import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import "../weather.css";

type StatusKey = "regular" | "limited" | "suspended";

const STATUS: Record<StatusKey, { label: string; short: string }> = {
  regular: { label: "Die Bahn fährt regulär", short: "Regulär" },
  limited: { label: "Eingeschränkter Betrieb", short: "Eingeschränkt" },
  suspended: { label: "Betrieb eingestellt", short: "Eingestellt" },
};

// Koordinaten sind ungefähre Werte – bei Bedarf anpassen
const STATIONS = [
  { name: "Bergstation", lat: 47.511, lon: 9.78, elevation: 1064 },
  { name: "Talstation Bregenz", lat: 47.505, lon: 9.755, elevation: 417 },
];

type Current = {
  temperature_2m: number;
  wind_speed_10m: number;
  wind_gusts_10m: number;
  wind_direction_10m: number;
  precipitation: number;
  weather_code: number;
  cloud_cover: number;
  visibility: number;
};

const COMPASS = [
  "N",
  "NNO",
  "NO",
  "ONO",
  "O",
  "OSO",
  "SO",
  "SSO",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];
const compass = (deg: number) => COMPASS[Math.round(deg / 22.5) % 16];

function skyText(code: number): string {
  if (code === 0) return "Klar";
  if (code === 1) return "Überwiegend klar";
  if (code === 2) return "Teils bewölkt";
  if (code === 3) return "Bedeckt";
  if (code === 45 || code === 48) return "Nebel";
  if (code >= 51 && code <= 57) return "Nieselregen";
  if (code >= 61 && code <= 67) return "Regen";
  if (code >= 71 && code <= 77) return "Schneefall";
  if (code >= 80 && code <= 82) return "Regenschauer";
  if (code === 85 || code === 86) return "Schneeschauer";
  if (code >= 95) return "Gewitter";
  return "–";
}

const fmtVis = (m: number) =>
  m >= 10000
    ? `${Math.round(m / 1000)} km`
    : m >= 1000
      ? `${(m / 1000).toFixed(1).replace(".", ",")} km`
      : `${Math.round(m)} m`;

export default function WeatherStatus({ isPlanner }: { isPlanner: boolean }) {
  const [status, setStatus] = useState<StatusKey>("regular");
  const [note, setNote] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [statusError, setStatusError] = useState("");

  const [weather, setWeather] = useState<Current[] | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const [editing, setEditing] = useState(false);
  const [draftStatus, setDraftStatus] = useState<StatusKey>("regular");
  const [draftNote, setDraftNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadStatus = useCallback(async () => {
    const { data, error } = await supabase
      .from("operation_status")
      .select("status, note, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      setStatusError("Betriebsstatus nicht verfügbar");
      return;
    }
    setStatusError("");
    if (data) {
      setStatus(data.status as StatusKey);
      setNote(data.note ?? "");
      setUpdatedAt(data.updated_at);
    }
  }, []);

  const loadWeather = useCallback(async () => {
    try {
      const url =
        "https://api.open-meteo.com/v1/forecast" +
        `?latitude=${STATIONS.map((s) => s.lat).join(",")}` +
        `&longitude=${STATIONS.map((s) => s.lon).join(",")}` +
        `&elevation=${STATIONS.map((s) => s.elevation).join(",")}` +
        "&current=temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,weather_code,cloud_cover,visibility" +
        "&timezone=Europe%2FVienna";
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const arr = Array.isArray(json) ? json : [json];
      setWeather(arr.map((x: any) => x.current as Current));
      setFetchedAt(new Date());
      setWeatherError(false);
    } catch {
      setWeatherError(true);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadWeather();
    const a = setInterval(loadStatus, 2 * 60 * 1000);
    const b = setInterval(loadWeather, 10 * 60 * 1000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [loadStatus, loadWeather]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("operation_status")
      .update({
        status: draftStatus,
        note: draftNote.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) return alert("Speichern fehlgeschlagen: " + error.message);
    setEditing(false);
    loadStatus();
  }

  const showBanner = status !== "regular" || !!statusError;
  const toggleEditor = () => {
    setDraftStatus(status);
    setDraftNote(note);
    setEditing((v) => !v);
  };

  return (
    <section className="ws-wrap" aria-label="Wetter und Betriebsstatus">
      {showBanner && (
        <div className={`ws-status ws-${status}`}>
          <span className="ws-light" aria-hidden />
          <div className="ws-status-text">
            <div className="ws-status-title">
              {statusError || STATUS[status].label}
            </div>
            {note && <div className="ws-status-note">{note}</div>}
            {updatedAt && (
              <div className="ws-status-time">
                Stand{" "}
                {new Date(updatedAt).toLocaleString("de-AT", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                Uhr
              </div>
            )}
          </div>
          {isPlanner && (
            <button className="ws-edit" onClick={toggleEditor}>
              {editing ? "Schließen" : "Status ändern"}
            </button>
          )}
        </div>
      )}

      {!showBanner && isPlanner && (
        <button className="ws-edit ws-edit-solo" onClick={toggleEditor}>
          {editing ? "Schließen" : "Einschränkung melden"}
        </button>
      )}

      {isPlanner && editing && (
        <div className="ws-editor">
          <div className="ws-choices">
            {(Object.keys(STATUS) as StatusKey[]).map((k) => (
              <button
                key={k}
                className={`ws-choice ws-c-${k} ${draftStatus === k ? "on" : ""}`}
                onClick={() => setDraftStatus(k)}
              >
                {STATUS[k].short}
              </button>
            ))}
          </div>
          <input
            className="ws-input"
            maxLength={200}
            value={draftNote}
            placeholder="Hinweis für alle, z. B. „Talfahrt ab 17:00 Uhr nur mit Wartezeit“"
            onChange={(e) => setDraftNote(e.target.value)}
          />
          <button className="ws-save" onClick={save} disabled={saving}>
            {saving ? "Speichert …" : "Für alle anzeigen"}
          </button>
        </div>
      )}

      <div className="ws-grid">
        {STATIONS.map((s, i) => {
          const w = weather?.[i];
          return (
            <div className="ws-card" key={s.name}>
              <div className="ws-card-head">
                <b>{s.name}</b>
                <span>{s.elevation} m</span>
              </div>
              {w ? (
                <>
                  <div className="ws-temp">
                    {Math.round(w.temperature_2m)}°
                    <small>{skyText(w.weather_code)}</small>
                  </div>
                  <dl className="ws-facts">
                    <div>
                      <dt>Wind</dt>
                      <dd>
                        {Math.round(w.wind_speed_10m)} km/h{" "}
                        {compass(w.wind_direction_10m)}
                      </dd>
                    </div>
                    <div>
                      <dt>Böen</dt>
                      <dd>{Math.round(w.wind_gusts_10m)} km/h</dd>
                    </div>
                    <div>
                      <dt>Sicht</dt>
                      <dd>{fmtVis(w.visibility)}</dd>
                    </div>
                    <div>
                      <dt>Wolken</dt>
                      <dd>{Math.round(w.cloud_cover)} %</dd>
                    </div>
                    <div>
                      <dt>Regen</dt>
                      <dd>{w.precipitation} mm</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <div className="ws-loading">
                  {weatherError ? "Wetterdaten nicht erreichbar" : "Lade …"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="ws-foot">
        Modelldaten (Open-Meteo)
        {fetchedAt &&
          `, ${fetchedAt.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })} Uhr`}{" "}
        – keine Messwerte vor Ort. Aktuelle Messwerte:{" "}
        <a href="https://www.wetterring.at" target="_blank" rel="noreferrer">
          wetterring.at
        </a>{" "}
        · Wind-Info: <a href="tel:+4355744216030">+43 5574 42 160-30</a>
      </p>
    </section>
  );
}
