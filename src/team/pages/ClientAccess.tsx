import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

/**
 * Public client entry — distinct from /login (which is referral-gated for staff).
 * Lets a buyer:
 *   1. Sign in or create a free account (no referral code required)
 *   2. Redeem their RHZ-XXXX-XXXX project code to attach the project to their account
 *   3. Get redirected to /portal/:id
 */
export default function ClientAccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState(params.get("code") ?? "");
  const [busy, setBusy] = useState(false);

  // If already signed in, jump straight to redeem step.
  useEffect(() => {
    if (!loading && session && code) {
      void redeem();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session]);

  async function redeem() {
    if (!code.trim()) {
      toast({ title: "Project code required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { data: projectId, error } = await supabase.rpc("redeem_project_code", { _code: code.trim() });
      if (error) throw error;
      if (!projectId) throw new Error("Code invalid or already used");
      toast({ title: "Project linked", description: "Welcome to your portal." });
      navigate(`/portal/${projectId}`, { replace: true });
    } catch (e: any) {
      toast({ title: "Could not redeem code", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || password.length < 6) {
      toast({ title: "Enter a valid email and 6+ char password", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Auth listener will trigger redeem via the effect above (if code present).
        if (!code) toast({ title: "Welcome back" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/team.html#/client?code=${encodeURIComponent(code)}` },
        });
        if (error) throw error;
        if (!data.session) {
          toast({
            title: "Check your email",
            description: "Confirm your email, then you'll be returned here to link your project.",
          });
          if (code) localStorage.setItem("pending_project_code", code);
        }
      }
    } catch (err: any) {
      toast({ title: mode === "signin" ? "Sign-in failed" : "Sign-up failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  // Signed in but no code → ask for code
  if (session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm border border-border rounded-2xl bg-card p-8 space-y-5">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Rhozeland</div>
            <h1 className="text-2xl font-semibold mt-1">Link your project</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter the project code from your payment confirmation.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="code">Project code</Label>
            <Input id="code" placeholder="RHZ-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </div>
          <Button onClick={redeem} disabled={busy} className="w-full">Open my portal</Button>
          <button type="button" className="w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => supabase.auth.signOut()}>
            Not you? Sign out
          </button>
        </div>
      </div>
    );
  }

  // Signed out → signin/signup
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm border border-border rounded-2xl bg-card p-8 space-y-5">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Rhozeland</div>
          <h1 className="text-2xl font-semibold mt-1">Client portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signup" ? "Create a free account to access your project." : "Sign in to access your project."}
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Use the email you paid with for the smoothest setup.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="code">Project code (optional now, required to view portal)</Label>
            <Input id="code" placeholder="RHZ-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>
        <button type="button" className="w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </div>
    </div>
  );
}