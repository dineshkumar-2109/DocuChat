import { useState } from "react";
import { api } from "./api.js";
import Icon from "./icons.jsx";
import Logo from "./Logo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

const FEATURES = [
  { icon: "quote", title: "Answers you can verify", text: "Every answer links to the exact passage it came from." },
  { icon: "file", title: "One document at a time", text: "Questions are answered from the document you choose — nothing else." },
  { icon: "shield", title: "Private by default", text: "Your files are only ever visible to your account." },
];

export default function AuthPage({ onSignedIn, theme, onToggleTheme }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");

    setBusy(true);
    try {
      const data = await api(`/api/auth/${mode}`, { method: "POST", json: { email: email.trim(), password } });
      onSignedIn(data);
    } catch (err) {
      setError(err.status === 429 ? "Too many attempts. Please wait a few minutes and try again." : err.message);
      setBusy(false);
    }
  }

  const switchMode = (m) => { setMode(m); setError(""); };

  return (
    <div className="landing">
      <header className="landing-header">
        <Logo />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </header>

      <main className="landing-main">
        <section className="landing-intro">
          <h1>Chat with your documents.</h1>
          <p className="lede">
            Upload a report, contract or set of notes and ask questions in plain language.
            DocuChat answers from that document only — and shows you where each answer came from.
          </p>
        </section>

        <section className="auth-card" aria-labelledby="auth-heading">
          <h2 id="auth-heading">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="muted">{mode === "login" ? "Sign in to continue to your library." : "It's free and takes a few seconds."}</p>

          <div className="segmented" role="tablist" data-active={mode}>
            <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => switchMode("login")}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => switchMode("register")}>Create account</button>
          </div>

          <form onSubmit={submit} noValidate className="auth-form">
            <label className="field">
              <span>Email</span>
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </label>
            {error && <p className="form-error" role="alert"><Icon name="alert" size={16} />{error}</p>}
            <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </section>

        <ul className="features">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className="feature-icon"><Icon name={f.icon} /></span>
              <div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </main>

      <footer className="landing-footer">© {new Date().getFullYear()} DocuChat</footer>
    </div>
  );
}
