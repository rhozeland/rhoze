import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

/**
 * Unified portal — one page handles client + team, sign-in + sign-up,
 * optional project code redemption and optional team referral code.
 * After auth resolves we route by role:
 *   admin/employee → /  (team dashboard)
 *   client w/ pending code → /portal/:id
 *   client → /client/home
 */

const emailSchema = z.string().trim().email().max(255);

export default function Portal() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session, loading, roles, isTeam, refreshRoles } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [code, setCode] = useState(params.get("code") ?? "");
  const [referral, setReferral] = useState(params.get("ref") ?? "");
  const [showCode, setShowCode] = useState(!!params.get("code"));
  const [showReferral, setShowReferral] = useState(!!params.get("ref"));
  const [busy, setBusy] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  // Smart router: once we know the session + roles, send the user where they belong.
  useEffect(() => {
    if (loading || !session) return;
    let cancelled = false;
    (async () => {
      // Pending project code (from URL or stored at signup) → redeem then route.
      const pendingCode =
        code.trim() || localStorage.getItem("pending_project_code") || "";
      if (pendingCode) {
        setRedeeming(true);
        const { data: projectId, error } = await supabase.rpc("redeem_project_code", {
          _code: pendingCode.trim(),
        });
        if (cancelled) return;
        if (!error && projectId) {
          localStorage.removeItem("pending_project_code");
          await refreshRoles();
          toast({ title: "Project linked" });
          navigate(`/portal/${projectId}`, { replace: true });
          return;
        }
        if (error) {
          toast({
            title: "Couldn't redeem code",
            description: error.message,
            variant: "destructive",
          });
        }
        setRedeeming(false);
      }
      // Role-based routing.
      if (isTeam) {
        navigate("/", { replace: true });
      } else if (roles.includes("client") || roles.length === 0) {
        navigate("/client/home", { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, isTeam, roles.join(",")]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const okEmail = emailSchema.safeParse(email);
    if (!okEmail.success || password.length < 6) {
      toast({
        title: "Check your input",
        description: "Valid email and 6+ character password required.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Stash codes so the post-auth effect picks them up.
        if (code.trim()) localStorage.setItem("pending_project_code", code.trim());
        if (referral.trim()) localStorage.setItem("pending_referral_code", referral.trim());
        toast({ title: "Welcome back" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/team.html#/portal${
              code ? `?code=${encodeURIComponent(code)}` : ""
            }`,
            data: fullName.trim()
              ? { display_name: fullName.trim() }
              : undefined,
          },
        });
        if (error) throw error;
        if (code.trim()) localStorage.setItem("pending_project_code", code.trim());
        if (referral.trim()) localStorage.setItem("pending_referral_code", referral.trim());
        if (!data.session) {
          toast({
            title: "Check your email",
            description: "Confirm your email, then return here to finish signing in.",
          });
        }
      }
    } catch (err: any) {
      toast({
        title: mode === "signin" ? "Sign-in failed" : "Sign-up failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading || redeeming) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-sm text-muted-foreground">
          {redeeming ? "Linking your project…" : "Loading…"}
        </div>
      </div>
    );
  }

  // Signed-in: show interstitial while smart-router decides.
  if (session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Rhozeland
          </div>
          <h1 className="text-2xl font-semibold">Signing you in…</h1>
          <p className="text-sm text-muted-foreground">
            If this takes more than a moment, you can{" "}
            <button
              type="button"
              className="underline"
              onClick={() => supabase.auth.signOut()}
            >
              sign out
            </button>{" "}
            and try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Rhozeland
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            One door for clients and team. We'll route you to the right place.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="fullName">
                Full name <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="fullName"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {showCode ? (
            <div className="space-y-1.5">
              <Label htmlFor="code">Project code</Label>
              <Input
                id="code"
                placeholder="RHZ-XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <p className="text-[11px] text-muted-foreground">
                From your payment confirmation. Links the project to your account.
              </p>
            </div>
          ) : (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowCode(true)}
            >
              + Have a project code?
            </button>
          )}

          {showReferral ? (
            <div className="space-y-1.5">
              <Label htmlFor="ref">Team referral code</Label>
              <Input
                id="ref"
                autoComplete="off"
                value={referral}
                onChange={(e) => setReferral(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Required for staff / contractor access. Ask an admin.
              </p>
            </div>
          ) : (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground block"
              onClick={() => setShowReferral(true)}
            >
              + Joining the team? Add referral code
            </button>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? "Working…"
              : mode === "signin"
              ? "Sign in"
              : "Create account"}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin"
              ? "Need an account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>

        <p className="text-[11px] text-center text-muted-foreground">
          By continuing you agree to Rhozeland's terms. Issues signing in?{" "}
          <a href="/contact.html" className="underline">
            Contact us
          </a>
          .
        </p>
      </div>
    </div>
  );
}