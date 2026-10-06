import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const withTimeout = <T,>(p: Promise<T>, ms = 15000) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/** Email/password (or Google) sign up / log in. Calls onDone once a session exists. */
export default function AuthModal({ onClose, onDone, redirectTo, intro, action = " and publish" }: {
  onClose: () => void; onDone: () => void; redirectTo: string; intro?: string; action?: string;
}) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [sent, setSent] = useState(false);

  const switchTo = (m: "signup" | "login") => { setMode(m); setErr(""); setInfo(""); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) return setErr("Enter a valid email.");
    if (password.length < (mode === "signup" ? 8 : 6)) return setErr(mode === "signup" ? "Use at least 8 characters for your password." : "Enter your password.");
    setBusy(true); setErr(""); setInfo("");
    try {
      if (mode === "login") {
        const { error } = await withTimeout(supabase.auth.signInWithPassword({ email: em, password }));
        if (error) {
          const code = (error as any).code || "";
          if (code === "email_not_confirmed" || /confirm/i.test(error.message)) return setErr("Please confirm your email first. Check your inbox for the link we sent.");
          if (code === "invalid_credentials" || /invalid/i.test(error.message)) return setErr("That email and password don't match. Try again, reset your password, or sign up.");
          return setErr(error.message || "We couldn't log you in. Please try again.");
        }
        onDone();
      } else {
        const { data, error } = await withTimeout(supabase.auth.signUp({ email: em, password, options: { emailRedirectTo: redirectTo } }));
        if (error) {
          if (/registered|exists/i.test(error.message)) { switchTo("login"); return setErr("You already have an account with this email. Log in instead."); }
          if (/weak|password/i.test(error.message)) return setErr(error.message);
          return setErr(error.message || "We couldn't create your account. Please try again.");
        }
        // An existing email comes back with no identities and no session.
        if (!data.session && data.user && (data.user.identities?.length ?? 0) === 0) {
          switchTo("login"); return setErr("You already have an account with this email. Log in instead.");
        }
        if (data.session) onDone(); else setSent(true);
      }
    } catch {
      setErr("The connection timed out. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) return setErr("Type your email above first, then tap Forgot password.");
    setBusy(true); setErr("");
    const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo: "https://www.rhozeland.com/team.html#/reset-password" });
    setBusy(false);
    if (error) return setErr(error.message || "We couldn't send the reset email.");
    setInfo(`We sent a password reset link to ${em}.`);
  };

  const google = async () => {
    setBusy(true); setErr("");
    try {
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: redirectTo });
      if (r.error) { setErr("Google sign-in didn't work. Please try again or use email."); return; }
      if (r.redirected) return;
      onDone();
    } catch { setErr("Google sign-in didn't work. Please try again or use email."); }
    finally { setBusy(false); }
  };

  return (
    <div className="rz-modal" onClick={() => !busy && onClose()}>
      <div className="rz-card" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <div className="rz-head" style={{ marginBottom: 0 }}>
            <h1>Check your email</h1>
            <p>We sent a confirmation link to <b>{email}</b>. Open it to finish signing in. Everything you entered is saved.</p>
            <div className="rz-actions"><button className="rz-btn" onClick={onClose}>Close</button></div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="rz-chips" style={{ justifyContent: "center" }}>
              <button type="button" className={`rz-chipbtn ${mode === "signup" ? "on" : ""}`} onClick={() => switchTo("signup")}>Sign up</button>
              <button type="button" className={`rz-chipbtn ${mode === "login" ? "on" : ""}`} onClick={() => switchTo("login")}>Log in</button>
            </div>
            <div className="rz-head" style={{ marginBottom: "1rem" }}>
              <h1>{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
              <p>{intro || "Your project is saved. Sign in to publish it and manage it from any device."}</p>
            </div>
            <button type="button" className="rz-btn" style={{ width: "100%", marginBottom: ".8rem" }} onClick={google} disabled={busy}>Continue with Google</button>
            <div className="rz-note" style={{ margin: "0 0 .7rem" }}>or use your email</div>
            <div className="rz-field" style={{ marginBottom: ".7rem" }}><label>Email</label><input className="rz-in" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="rz-field"><label>Password</label><input className="rz-in" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
              {mode === "login" && <div style={{ textAlign: "right", marginTop: ".3rem" }}><button type="button" className="rz-textlink" onClick={forgot} disabled={busy}>Forgot password?</button></div>}
            </div>
            {err && <div className="rz-err">{err}</div>}
            {info && <div className="rz-note">{info}</div>}
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
