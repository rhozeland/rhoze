import { FormEvent, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const signinSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});
const signupSchema = signinSchema.extend({
  referralCode: z.string().trim().min(4).max(64),
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  alias: z.string().trim().max(60).optional().or(z.literal("")),
});

export default function TeamLogin() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [alias, setAlias] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate("/", { replace: true });
  }, [session, loading, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === "signin") {
      const parsed = signinSchema.safeParse({ email, password });
      if (!parsed.success) {
        toast({ title: "Check your input", description: "Valid email and 6+ char password required.", variant: "destructive" });
        return;
      }
    } else {
      const parsed = signupSchema.safeParse({ email, password, referralCode, fullName, alias });
      if (!parsed.success) {
        toast({ title: "Check your input", description: "Name, email, 6+ char password, and a referral code are required.", variant: "destructive" });
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Welcome back" });
      } else {
        // Sign up, then immediately consume the referral code to assign role.
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/team.html`,
            data: {
              display_name: fullName.trim(),
              alias: alias.trim() || null,
            },
          },
        });
        if (error) throw error;

        // If session exists (auto-confirm enabled), consume now.
        if (signUpData.session) {
          const { error: rpcErr } = await supabase.rpc("consume_referral_code", { _code: referralCode });
          if (rpcErr) {
            toast({
              title: "Account created, code rejected",
              description: rpcErr.message + " — ask an admin for a valid referral code.",
              variant: "destructive",
            });
          } else {
            toast({ title: "Welcome to the team", description: "Referral code accepted." });
          }
        } else {
          // Email confirmation required — store code so it can be consumed after first sign-in.
          localStorage.setItem("pending_referral_code", referralCode);
          toast({
            title: "Check your email",
            description: "Confirm your email, then sign in to activate your team access.",
          });
        }
      }
    } catch (err: any) {
      toast({ title: mode === "signin" ? "Sign-in failed" : "Sign-up failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm border border-border rounded-lg bg-card p-8 space-y-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Rhozeland</div>
          <h1 className="text-2xl font-semibold mt-1">Team Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Internal access only.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {mode === "signup" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alias">Alias <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="alias"
                  type="text"
                  autoComplete="nickname"
                  placeholder="Stage / artist name"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                />
              </div>
            <div className="space-y-1.5">
              <Label htmlFor="referral">Referral code</Label>
              <Input
                id="referral"
                type="text"
                autoComplete="off"
                required
                placeholder="Provided by your admin"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                A valid referral code is required. Contact an admin if you don't have one.
              </p>
            </div>
            </>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <button type="button" className="w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}