import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Email/password sign up or log in. Calls onDone once a session exists. */
export default function AuthModal({ onClose, onDone, redirectTo, intro, action = " and publish" }: {
  onClose: () => void; onDone: () => void; redirectTo: string; intro?: string; action?: string;
}) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr("Enter a valid email.");
    if (password.length < 8) return setErr("Use at least 8 characters for your password.");
    setBusy(true); setErr("");
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) return setErr("That email and password don't match. Try again or sign up.");
      onDone();
    } else {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo } });
      setBusy(false);
      if (error) return setErr(/registered|exists/i.test(error.message) ? "You already have an account. Log in instead." : "We couldn't create your account. Please try again.");
      if (data.session) onDone(); else setSent(true);
    }
  };

  return (
    <div className="rz-modal" onClick={() => !busy && onClose()}>
      <div className="rz-card" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <div className="rz-head" style={{ marginBottom: 0 }}>
            <h1>Check your email</h1>
            <p>We sent a confirmation link to <b>{email}</b>. Open it and we'll publish your project automatically. Everything you entered is saved.</p>
            <div className="rz-actions"><button className="rz-btn" onClick={onClose}>Close</button></div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="rz-chips" style={{ justifyContent: "center" }}>
              <button type="button" className={`rz-chipbtn ${mode === "signup" ? "on" : ""}`} onClick={() => { setMode("signup"); setErr(""); }}>Sign up</button>
              <button type="button" className={`rz-chipbtn ${mode === "login" ? "on" : ""}`} onClick={() => { setMode("login"); setErr(""); }}>Log in</button>
            </div>
            <div className="rz-head" style={{ marginBottom: "1rem" }}>
              <h1>{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
              <p>{intro || "Your project is saved. Sign in to publish it and manage it from any device."}</p>
            </div>
            <div className="rz-field" style={{ marginBottom: ".7rem" }}><label>Email</label><input className="rz-in" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="rz-field"><label>Password</label><input className="rz-in" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {err && <div className="rz-err">{err}</div>}
            <div className="rz-actions">
              <button type="button" className="rz-btn" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className="rz-btn pri" disabled={busy}>{busy ? "One moment…" : mode === "signup" ? `Sign up${action}` : `Log in${action}`}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
