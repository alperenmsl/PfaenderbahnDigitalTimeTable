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

/* ---- Echte Messwerte: GeoSphere Austria (Station Bregenz, ID 11101) ---- */
const GEO =
  "https://dataset.api.hub.geosphere.at/v1/station/current/tawes-v1-10min";
const GEO_STATION = "11101";
const GEO_WANT = ["TL", "FFAM", "FF", "FFX", "DD", "RR"];
let geoUnits: Record<string, string> | null = null;

type Measured = {
  temp: number | null;
  wind: number | null;
  gust: number | null;
  dir: number | null;
  rain: number | null;
  time: string | null;
};

async function fetchMeasured(): Promise<Measured> {
  if (!geoUnits) {
    const meta = await fetch(`${GEO}/metadata`).then((r) => {
      if (!r.ok) throw new Error("meta");
      return r.json();
    });
    geoUnits = {};
    (meta.parameters ?? []).forEach((p: any) => {
      geoUnits![p.name] = p.unit ?? "";
    });
  }
  const units = geoUnits;
  const params = GEO_WANT.filter((k) => k in units);
  const url = `${GEO}?station_ids=${GEO_STATION}&${params.map((k) => `parameters=${k}`).join("&")}`;
  const j = await fetch(url).then((r) => {
    if (!r.ok) throw new Error("data");
    return r.json();
  });
  const par = j.features?.[0]?.properties?.parameters ?? {};
  const ts: string[] = j.timestamps ?? [];
  const last = (k: string) => {
    const d: (number | null)[] | undefined = par[k]?.data;
    if (!d) return null;
    for (let i = d.length - 1; i >= 0; i--)
      if (d[i] != null) return { v: d[i] as number, t: ts[i] };
    return null;
  };
  const kmh = (k: string, v: number) =>
    (units[k] ?? "").includes("m/s") ? v * 3.6 : v;
  const temp = last("TL");
  const windK = last("FFAM") ? "FFAM" : "FF";
  const wind = last(windK);
  const gust = last("FFX");
  return {
    temp: temp?.v ?? null,
    wind: wind ? kmh(windK, wind.v) : null,
    gust: gust ? kmh("FFX", gust.v) : null,
    dir: last("DD")?.v ?? null,
    rain: last("RR")?.v ?? null,
    time: temp?.t ?? wind?.t ?? null,
  };
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
  const [measured, setMeasured] = useState<Measured | null>(null);

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

  const loadMeasured = useCallback(async () => {
    try {
      setMeasured(await fetchMeasured());
    } catch {
      setMeasured(null);
    } // dann zeigt die Karte Modelldaten
  }, []);

  useEffect(() => {
    loadStatus();
    loadWeather();
    loadMeasured();
    const a = setInterval(loadStatus, 2 * 60 * 1000);
    const b = setInterval(
      () => {
        loadWeather();
        loadMeasured();
      },
      10 * 60 * 1000,
    );
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [loadStatus, loadWeather, loadMeasured]);

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
          const m =
            i === 1 && measured && measured.temp != null ? measured : null;
          const temp = m ? m.temp! : w?.temperature_2m;
          const wind = m && m.wind != null ? m.wind : w?.wind_speed_10m;
          const gust = m && m.gust != null ? m.gust : w?.wind_gusts_10m;
          const dir = m && m.dir != null ? m.dir : w?.wind_direction_10m;
          const rain = m && m.rain != null ? m.rain : w?.precipitation;
          const when = m?.time
            ? new Date(m.time).toLocaleTimeString("de-AT", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : null;
          return (
            <div className="ws-card" key={s.name}>
              <div className="ws-card-head">
                <b>{s.name}</b>
                <span>
                  <em
                    className={`ws-badge ${m ? "ws-badge-live" : "ws-badge-model"}`}
                  >
                    {m ? `Messwert${when ? ` ${when} Uhr` : ""}` : "Modell"}
                  </em>{" "}
                  {s.elevation} m
                </span>
              </div>
              {temp != null ? (
                <>
                  <div className="ws-temp">
                    {Math.round(temp)}°
                    {w && <small>{skyText(w.weather_code)}</small>}
                  </div>
                  <dl className="ws-facts">
                    {wind != null && (
                      <div>
                        <dt>Wind</dt>
                        <dd>
                          {Math.round(wind)} km/h
                          {dir != null ? ` ${compass(dir)}` : ""}
                        </dd>
                      </div>
                    )}
                    {gust != null && (
                      <div>
                        <dt>Böen</dt>
                        <dd>{Math.round(gust)} km/h</dd>
                      </div>
                    )}
                    {w && (
                      <div>
                        <dt>Sicht (Modell)</dt>
                        <dd>{fmtVis(w.visibility)}</dd>
                      </div>
                    )}
                    {w && (
                      <div>
                        <dt>Wolken (Modell)</dt>
                        <dd>{Math.round(w.cloud_cover)} %</dd>
                      </div>
                    )}
                    {rain != null && (
                      <div>
                        <dt>{m ? "Regen (10 Min.)" : "Regen"}</dt>
                        <dd>{Number(rain).toFixed(1).replace(".", ",")} mm</dd>
                      </div>
                    )}
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
        Bregenz: Messwerte der Station Bregenz – Datenquelle:{" "}
        <a
          href="https://data.hub.geosphere.at"
          target="_blank"
          rel="noreferrer"
        >
          GeoSphere Austria
        </a>
        . Übrige Werte sind Modelldaten (Open-Meteo
        {fetchedAt &&
          `, ${fetchedAt.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })} Uhr`}
        ), keine Messung vor Ort am Berg. Aktuelle Messwerte vom Pfänder:{" "}
        <a href="https://www.wetterring.at" target="_blank" rel="noreferrer">
          wetterring.at
        </a>{" "}
        · Wind-Info: <a href="tel:+4355744216030">+43 5574 42 160-30</a>
      </p>
    </section>
  );
}
