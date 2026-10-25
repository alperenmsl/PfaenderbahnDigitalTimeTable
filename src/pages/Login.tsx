import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { EMPLOYEES } from "../data";

type Person = { id: string; full_name: string; login_email: string };

export default function Login() {
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("login_profiles")
      .select("id, full_name, login_email")
      .then(({ data }) => {
        const order = (n: string) => {
          const i = EMPLOYEES.findIndex((e) => e.name === n);
          return i === -1 ? 999 : i;
        };
        setPeople(
          (data ?? []).sort((a, b) => order(a.full_name) - order(b.full_name)),
        );
      });
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    const person = people.find((p) => p.id === selected);
    if (!person) return setError("Bitte wähle deinen Namen aus.");
    if (!pin) return setError("Bitte gib deine PIN ein.");
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: person.login_email,
      password: pin,
    });
    setBusy(false);
    if (error) setError("PIN falsch.");
  };

  const isBL = (name: string) =>
    EMPLOYEES.find((e) => e.name === name)?.isAdmin;

  return (
    <div className="fullscreen-login">
      <form className="login-blur-card" onSubmit={login}>
        <div className="login-brand-row">
          <div className="login-brand-icon" />
          <div className="login-brand-title">Pfänderbahn</div>
        </div>
        <div className="login-brand-sub">Pfänderbahn Mitarbeiter Portal</div>

        <div className="login-welcome">Willkommen zurück</div>
        <div className="login-desc-white">
          Wähle deinen Namen aus und gib deine PIN ein, um auf deinen
          persönlichen Dienstplan zuzugreifen.
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="field-label-white">Mitarbeiter auswählen</label>
          <select
            className="select-transparent"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setError("");
            }}
          >
            <option value="">— Bitte wählen —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
                {isBL(p.full_name) ? " - (BL)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 6 }}>
          <label className="field-label-white">PIN / Passwort</label>
          <input
            type="password"
            className="select-transparent"
            placeholder="••••••"
            autoComplete="current-password"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError("");
            }}
            style={{ paddingRight: 16 }}
          />
        </div>

        {error && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 14px",
              background: "rgba(220, 38, 38, 0.22)",
              border: "1px solid rgba(254, 202, 202, 0.45)",
              color: "#fff",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <button type="submit" className="btn-login-glow" disabled={busy}>
          {busy ? (
            <>
              <span className="loading-spinner" />
              Anmelden...
            </>
          ) : (
            <>
              Anmelden
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </>
          )}
        </button>

        <div className="login-foot-white">
          © 2026{" "}
          <a
            className="foot-link"
            href="https://axeoninformatics.rf.gd"
            target="_blank"
            rel="noopener noreferrer"
          >
            Axeoninformatics
          </a>{" "}
          - Pfänderbahn Mitarbeiter Portal
        </div>
      </form>
    </div>
  );
}
