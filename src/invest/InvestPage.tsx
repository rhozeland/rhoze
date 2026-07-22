// /invest — Rhozeland ICO investor page.
// Public landing + live campaign meter + tier picker + pledge form + personal
// dashboard. No online payment: pledges are logged and settled off-app.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, Check, Coins, Lock, Rocket, Shield, Sparkles, Wallet } from "lucide-react";
import logoWhite from "@/assets/logo-white.webp";

// ─── Types ────────────────────────────────────────────────────────────────
type Tier = "supporter" | "builder" | "core";
type Path = "self_serve" | "assisted";
type PayMethod = "square" | "etransfer" | "sol" | "usdc" | "other";

const TIERS: {
  slug: Tier;
  label: string;
  min: number;
  max: number | null;
  mult: number;
  perks: string[];
  tag: string;
}[] = [
  { slug: "supporter", label: "Supporter", min: 50, max: 499, mult: 1.00,
    perks: ["$RHOZE at 1:1 credits", "Cohort shoutout", "Early merch drop access"], tag: "Entry" },
  { slug: "builder", label: "Builder", min: 500, max: 1999, mult: 1.15,
    perks: ["+15% credit multiplier", "Priority studio booking", "Beta app access"], tag: "Most picked" },
  { slug: "core", label: "Core Cohort", min: 2000, max: null, mult: 1.40,
    perks: ["+40% credit multiplier", "Named cohort slot", "Governance weight on $RHOZE"], tag: "Whale" },
];

const LOCK_BONUS: Record<number, number> = { 0: 0, 1: 0.05, 3: 0.10, 6: 0.20, 12: 0.35 };

const pickTier = (amountUsd: number): Tier => {
  if (amountUsd >= 2000) return "core";
  if (amountUsd >= 500) return "builder";
  return "supporter";
};

// ─── Page ─────────────────────────────────────────────────────────────────
export default function InvestPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [pledges, setPledges] = useState<any[]>([]);
  const [aggregate, setAggregate] = useState<{ raised: number; cohort: number }>({ raised: 0, cohort: 0 });
  const [authOpen, setAuthOpen] = useState(false);
  const [pledgeOpen, setPledgeOpen] = useState(false);
  const [initialTier, setInitialTier] = useState<Tier>("builder");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadCampaign = async () => {
    const { data } = await supabase.from("campaign_state").select("*").eq("id", 1).maybeSingle();
    setCampaign(data);
  };
  const loadAggregate = async () => {
    const { data } = await supabase
      .from("investor_pledges")
      .select("amount_usd_cents, user_id, status")
      .in("status", ["confirmed", "settled", "fulfilled"]);
    if (!data) return;
    const raised = data.reduce((a, r: any) => a + Number(r.amount_usd_cents ?? 0), 0);
    const cohort = new Set(data.map((r: any) => r.user_id)).size;
    setAggregate({ raised, cohort });
  };
  const loadPledges = async () => {
    if (!session) { setPledges([]); return; }
    const { data } = await supabase
      .from("investor_pledges")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    setPledges(data ?? []);
  };

  useEffect(() => { loadCampaign(); loadAggregate(); }, []);
  useEffect(() => { loadPledges(); }, [session?.user?.id]);

  const remainingSol = Number(campaign?.remaining_sol ?? 45.3);
  const targetSol = Number(campaign?.total_target_sol ?? 85);
  const solPrice = Number(campaign?.sol_price_usd ?? 78);
  const bondedSol = Math.max(targetSol - remainingSol, 0);
  const bondedPct = Math.min(100, Math.round((bondedSol / targetSol) * 100));
  const remainingUsd = Math.round(remainingSol * solPrice);

  const openPledge = (tier: Tier) => {
    setInitialTier(tier);
    if (!session) { setAuthOpen(true); return; }
    setPledgeOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src={logoWhite} alt="Rhozeland" className="h-6 dark:invert-0 invert" />
            <span className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Cohort</span>
          </a>
          <div className="flex items-center gap-3 text-xs">
            <a href="/start.html" className="text-muted-foreground hover:text-foreground">Start a project</a>
            {session ? (
              <span className="text-foreground">{session.user.email}</span>
            ) : (
              <button onClick={() => setAuthOpen(true)} className="text-foreground underline underline-offset-4">
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-14">
        {/* Hero + meter */}
        <section>
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground mb-2">
            {campaign?.campaign_open ? "Campaign open · Graduation cohort" : "Campaign closed"}
          </div>
          <h1 className="text-3xl md:text-5xl tracking-tight leading-[1.05] max-w-3xl">
            {campaign?.headline ?? "Help graduate $RHOZE. Own the ecosystem."}
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            {campaign?.subhead ?? "Real people bonding a real ecosystem."} Pledges convert to $RHOZE + Rhozeland credits redeemable on merch, studio time, and app perks. No online payment — we settle via Square, e-transfer, or crypto and you see everything from your dashboard.
          </p>

          <CampaignMeter
            bondedSol={bondedSol}
            targetSol={targetSol}
            remainingSol={remainingSol}
            remainingUsd={remainingUsd}
            raisedCents={aggregate.raised}
            cohortCount={aggregate.cohort}
          />
        </section>

        {/* Tiers */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xl md:text-2xl tracking-tight">Pick your cohort tier</h2>
            <span className="text-xs text-muted-foreground">Assisted path adds 7% service fee.</span>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {TIERS.map((t) => (
              <TierCard key={t.slug} tier={t} onPick={() => openPledge(t.slug)} />
            ))}
          </div>
          <PathCompare />
        </section>

        {/* Personal dashboard */}
        {session && (
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-xl md:text-2xl tracking-tight">Your pledges</h2>
              <Button size="sm" onClick={() => setPledgeOpen(true)}>
                New pledge <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
            {pledges.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                No pledges yet. Pick a tier above to make your first one.
              </div>
            ) : (
              <div className="rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2">Date</th>
                      <th className="text-left px-4 py-2">Amount</th>
                      <th className="text-left px-4 py-2">Tier</th>
                      <th className="text-left px-4 py-2">Lock</th>
                      <th className="text-left px-4 py-2">Path</th>
                      <th className="text-left px-4 py-2">Fee</th>
                      <th className="text-left px-4 py-2">Credits</th>
                      <th className="text-left px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pledges.map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-4 py-2 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-2 tabular-nums">${(p.amount_usd_cents / 100).toLocaleString()}</td>
                        <td className="px-4 py-2 capitalize">{p.tier}</td>
                        <td className="px-4 py-2 tabular-nums">{p.lock_months ? `${p.lock_months} mo` : "—"}</td>
                        <td className="px-4 py-2 capitalize">{p.path.replace("_", "-")}</td>
                        <td className="px-4 py-2 tabular-nums">${(p.service_fee_cents / 100).toLocaleString()}</td>
                        <td className="px-4 py-2 tabular-nums">{Number(p.credits_awarded).toLocaleString()}</td>
                        <td className="px-4 py-2"><StatusPill status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Value pitch */}
        <section className="grid md:grid-cols-3 gap-4">
          <ValueCard icon={<Rocket className="w-4 h-4" />} title="Real utility, not vapor" body="Credits spend on merch, studio time, and app perks. You always have something to use." />
          <ValueCard icon={<Lock className="w-4 h-4" />} title="Optional locks, real bonuses" body="Longer commitment = higher multiplier. Skin in the game gets rewarded." />
          <ValueCard icon={<Shield className="w-4 h-4" />} title="Transparent settlement" body="Track your pledge from confirmation → on-chain settlement → credits issued. All in your dashboard." />
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 text-xs text-muted-foreground flex flex-wrap gap-3 justify-between">
          <span>© 2026 Rhozeland · collab@rhozeland.com</span>
          <span>Not financial advice. Cohort credits are non-transferable and subject to fulfillment terms.</span>
        </div>
      </footer>

      <PledgeDialog
        open={pledgeOpen}
        onOpenChange={setPledgeOpen}
        initialTier={initialTier}
        session={session}
        onCreated={() => { loadPledges(); loadAggregate(); }}
      />
      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        onSignedIn={() => { setAuthOpen(false); setPledgeOpen(true); }}
      />
    </div>
  );
}

// ─── Meter ────────────────────────────────────────────────────────────────
function CampaignMeter({ bondedSol, targetSol, remainingSol, remainingUsd, raisedCents, cohortCount }: {
  bondedSol: number; targetSol: number; remainingSol: number; remainingUsd: number; raisedCents: number; cohortCount: number;
}) {
  const pct = Math.min(100, Math.round((bondedSol / targetSol) * 100));
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Bonding curve</div>
          <div className="text-2xl md:text-3xl tabular-nums mt-1">
            {bondedSol.toFixed(1)} <span className="text-muted-foreground text-base">/ {targetSol} SOL</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Remaining</div>
          <div className="text-xl tabular-nums mt-1">{remainingSol.toFixed(2)} SOL · ${remainingUsd.toLocaleString()}</div>
        </div>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">Pledged to date</div>
          <div className="tabular-nums mt-0.5">${(raisedCents / 100).toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">Cohort size</div>
          <div className="tabular-nums mt-0.5">{cohortCount}</div>
        </div>
        <div>
          <div className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">Progress</div>
          <div className="tabular-nums mt-0.5">{pct}%</div>
        </div>
      </div>
    </div>
  );
}

// ─── Tier card ────────────────────────────────────────────────────────────
function TierCard({ tier, onPick }: { tier: typeof TIERS[number]; onPick: () => void }) {
  const featured = tier.slug === "builder";
  return (
    <div className={`rounded-2xl border p-5 flex flex-col ${featured ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{tier.label}</div>
        <Badge variant={featured ? "default" : "outline"} className="text-[10px]">{tier.tag}</Badge>
      </div>
      <div className="mt-2 text-2xl tabular-nums">
        ${tier.min.toLocaleString()}<span className="text-muted-foreground text-sm">{tier.max ? `–$${tier.max.toLocaleString()}` : "+"}</span>
      </div>
      <div className="text-xs text-muted-foreground mt-1">{tier.mult.toFixed(2)}× base credit multiplier</div>
      <ul className="mt-4 space-y-1.5 text-sm">
        {tier.perks.map((p) => (
          <li key={p} className="flex gap-2"><Check className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" /><span>{p}</span></li>
        ))}
      </ul>
      <Button className="mt-5 w-full" variant={featured ? "default" : "outline"} onClick={onPick}>
        Pledge {tier.label} <ArrowRight className="w-3.5 h-3.5 ml-1" />
      </Button>
    </div>
  );
}

function PathCompare() {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-muted/20 p-4 text-sm grid md:grid-cols-2 gap-4">
      <div>
        <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Self-Serve</div>
        <p className="mt-1 text-muted-foreground">You buy $RHOZE yourself on Pump.fun and (optionally) lock. Full multiplier, zero fee. Best for crypto natives.</p>
      </div>
      <div>
        <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Assisted (+7%)</div>
        <p className="mt-1 text-muted-foreground">Pay us in any method (Square, e-transfer, crypto). We execute the buy, lock, and issue your credits. You just watch the dashboard.</p>
      </div>
    </div>
  );
}

function ValueCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border p-5 bg-card">
      <div className="flex items-center gap-2 text-sm font-medium">{icon}{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
    confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    settled: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
    fulfilled: "bg-green-500/15 text-green-700 dark:text-green-400",
    cancelled: "bg-muted text-muted-foreground",
  };
  return <span className={`px-2 py-0.5 rounded-full text-[11px] capitalize ${map[status] ?? "bg-muted"}`}>{status}</span>;
}

// ─── Pledge Dialog ────────────────────────────────────────────────────────
function PledgeDialog({
  open, onOpenChange, initialTier, session, onCreated,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; initialTier: Tier;
  session: Session | null; onCreated: () => void;
}) {
  const [amount, setAmount] = useState<number>(500);
  const [lockMonths, setLockMonths] = useState<number>(3);
  const [path, setPath] = useState<Path>("assisted");
  const [payment, setPayment] = useState<PayMethod>("square");
  const [wallet, setWallet] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialTier === "supporter") setAmount(200);
    if (initialTier === "builder") setAmount(1000);
    if (initialTier === "core") setAmount(2500);
  }, [initialTier, open]);

  const tier = pickTier(amount);
  const baseMult = TIERS.find((t) => t.slug === tier)!.mult;
  const totalMult = Number((baseMult + (LOCK_BONUS[lockMonths] ?? 0)).toFixed(2));
  const fee = path === "assisted" ? Math.round(amount * 0.07) : 0;
  const credits = Math.floor(amount * totalMult);
  const total = amount + fee;

  const submit = async () => {
    if (!session) return;
    if (amount < 50) { toast({ title: "Minimum pledge is $50" }); return; }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_investor_pledge", {
        _amount_usd_cents: amount * 100,
        _lock_months: lockMonths,
        _path: path,
        _payment_method: payment,
        _solana_wallet: wallet.trim() || null,
        _notes: notes.trim() || null,
      });
      if (error) throw error;
      toast({ title: "Pledge submitted", description: "We'll reach out to settle payment." });
      onCreated();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Couldn't submit pledge", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New pledge</DialogTitle>
          <DialogDescription>Log your intent. We follow up to settle payment and issue credits.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Amount (USD)</Label>
            <Input type="number" min={50} step={50} value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} />
            <div className="mt-1 text-xs text-muted-foreground">
              Auto-tier: <span className="text-foreground capitalize">{tier}</span> · base {baseMult.toFixed(2)}×
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Lock length</Label>
              <Select value={String(lockMonths)} onValueChange={(v) => setLockMonths(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No lock</SelectItem>
                  <SelectItem value="1">1 month (+5%)</SelectItem>
                  <SelectItem value="3">3 months (+10%)</SelectItem>
                  <SelectItem value="6">6 months (+20%)</SelectItem>
                  <SelectItem value="12">12 months (+35%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Path</Label>
              <Select value={path} onValueChange={(v) => setPath(v as Path)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="assisted">Assisted (+7% fee)</SelectItem>
                  <SelectItem value="self_serve">Self-serve (no fee)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Payment method</Label>
              <Select value={payment} onValueChange={(v) => setPayment(v as PayMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="square">Square (in-person / invoice)</SelectItem>
                  <SelectItem value="etransfer">E-transfer</SelectItem>
                  <SelectItem value="sol">SOL to treasury</SelectItem>
                  <SelectItem value="usdc">USDC</SelectItem>
                  <SelectItem value="other">Other (specify in notes)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Solana wallet (optional)</Label>
              <Input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="For $RHOZE delivery" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything we should know?" />
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-1.5 text-sm">
            <Row label="Pledge amount" value={`$${amount.toLocaleString()}`} />
            <Row label={`Service fee (${path === "assisted" ? "7%" : "0%"})`} value={`$${fee.toLocaleString()}`} />
            <Row label="Total to send" value={`$${total.toLocaleString()}`} bold />
            <Row label={`Credits (${totalMult.toFixed(2)}×)`} value={`${credits.toLocaleString()} $RHOZE credits`} />
          </div>

          <Button className="w-full" disabled={busy} onClick={submit}>
            {busy ? "Submitting…" : "Submit pledge"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            No charge now. We'll follow up within 24h to arrange payment and log settlement on-chain.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-medium text-foreground" : ""}`}>{value}</span>
    </div>
  );
}

// ─── Auth Dialog ──────────────────────────────────────────────────────────
function AuthDialog({ open, onOpenChange, onSignedIn }: {
  open: boolean; onOpenChange: (o: boolean) => void; onSignedIn: () => void;
}) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const { error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/invest.html" } });
    setBusy(false);
    if (error) { toast({ title: "Auth failed", description: error.message, variant: "destructive" }); return; }
    if (mode === "up") { toast({ title: "Check your email to confirm." }); onOpenChange(false); return; }
    onSignedIn();
  };
  const google = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/invest.html" },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "in" ? "Sign in to pledge" : "Create an account"}</DialogTitle>
          <DialogDescription>Track your pledges, lock status, and credits.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button className="w-full" disabled={busy} onClick={submit}>
            {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
          </Button>
          <button className="text-xs text-muted-foreground underline w-full" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
          <div className="text-center text-[11px] uppercase tracking-wider text-muted-foreground">or</div>
          <Button variant="outline" onClick={google} className="w-full">Continue with Google</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}