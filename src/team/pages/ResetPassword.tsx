import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

/**
 * Password reset landing page. The emailed recovery link lands here with
 * `type=recovery` in the URL hash; Supabase exchanges it for a session and
 * we then let the user set a new password.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Recovery links arrive with tokens in the URL hash. Because this app
    // uses hash routing, the final URL can look like
    // /team.html#/reset-password#access_token=...&type=recovery — so we
    // parse tokens manually anywhere in the hash instead of relying on
    // Supabase's auto-detection.
    const hash = window.location.hash;
    const isRecovery = hash.includes("type=recovery");
    const at = hash.match(/access_token=([^&]+)/)?.[1];
    const rt = hash.match(/refresh_token=([^&]+)/)?.[1];

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !cancelled) setReady(true);
    });

    (async () => {
      if (at && isRecovery) {
        // Exchange the emailed tokens for a recovery session ourselves.
        const { error } = await supabase.auth.setSession({
          access_token: decodeURIComponent(at),
          refresh_token: rt ? decodeURIComponent(rt) : "",
        });
        if (cancelled) return;
        if (!error) {
          // Clean the tokens out of the address bar.
          window.history.replaceState(null, "", "#/reset-password");
          setReady(true);
          return;
        }
        setInvalid(true);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session && isRecovery) setReady(true);
      else if (session && !at) setReady(true); // signed-in users can also land here
      else if (!isRecovery) setInvalid(true);
      // else: wait for onAuthStateChange PASSWORD_RECOVERY
      // Safety timeout: if nothing arrives, show the invalid state.
      setTimeout(() => {
        if (cancelled) return;
        setReady((r) => {
          if (!r) setInvalid(true);
          return r;
        });
      }, 6000);
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Use at least 6 characters.",
        variant: "destructive",
      });
      return;
    }
    if (password !== confirm) {
      toast({
        title: "Passwords don't match",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Password updated", description: "You're signed in with your new password." });
      navigate("/portal", { replace: true });
    } catch (err: any) {
      toast({
        title: "Couldn't update password",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        <a
          href="/"
          className="inline-block text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to Rhozeland
        </a>
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Rhozeland
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Set a new password</h1>
          <p className="text-sm text-muted-foreground">
            Choose a new password for your account.
          </p>
        </div>

        {invalid && !ready ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This reset link is invalid or has expired. Request a new one from the
              sign-in page.
            </p>
            <Button className="w-full" onClick={() => navigate("/portal", { replace: true })}>
              Back to sign in
            </Button>
          </div>
        ) : !ready ? (
          <p className="text-sm text-muted-foreground">Verifying your reset link…</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
