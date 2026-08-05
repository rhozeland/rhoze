// /invest — $RHOZE has graduated. Simple buy flow: pick an amount, checkout
// with Square (our POS), and the order lands in your account dashboard.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import type { Session } from "@supabase/supabase-js";
import { Check, CheckCircle2, Coins, CreditCard, Sparkles } from "lucide-react";
import logoWhite from "@/assets/logo-white.webp";
import WalletPanel from "./WalletPanel";

type Tier = "supporter" | "builder" | "core";
type PayMethod = "square" | "etransfer" | "sol" | "usdc" | "other";

const TIERS: { slug: Tier; label: string; min: number; mult: number; perk: string }[] = [
  { slug: "supporter", label: "Supporter", min: 50, mult: 1.0, perk: "1:1 credits + early merch drops" },
  { slug: "builder", label: "Builder", min: 500, mult: 1.15, perk: "+15% credits, priority studio booking" },
  { slug: "core", label: "Core", min: 2000, mult: 1.4, perk: "+40% credits, named slot, governance weight" },
];

const AMOUNTS = [50, 100, 250, 500, 1000, 2500];
const LOCK_BONUS: Record<number, number> = { 0: 0, 3: 0.1, 6: 0.2, 12: 0.35 };

const pickTier = (usd: number): Tier => (usd >= 2000 ? "core" : usd >= 500 ? "builder" : "supporter");
const multFor = (usd: number) => TIERS.find((t) => t.slug === pickTier(usd))!.mult;

export default function InvestPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [holders, setHolders] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [amount, setAmount] = useState(250);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadCampaign = async () => {
    const { data } = await supabase.from("campaign_state").select("*").eq("id", 1).maybeSingle();
    setCampaign(data);
  };
  const loadHolders = async () => {
    const { data } = await supabase
      .from("investor_pledges").select("user_id, status")
      .in("status", ["confirmed", "settled", "fulfilled"]);
    setHolders(new Set((data ?? []).map((r: any) => r.user_id)).size);
  };
  useEffect(() => { loadCampaign(); loadHolders(); }, []);

  // When embedded in the homepage iframe (auto-sized to content), a fixed-position
  // dialog centers inside the tall iframe viewport and lands off-screen. Ask the
  // parent to scroll it into view whenever a dialog opens.
  useEffect(() => {
    if (!buyOpen && !authOpen) return;
    if (window.parent === window) return;
    try { window.parent.postMessage({ type: "rhoze:dialog-open" }, "*"); } catch { /* ignore */ }
  }, [buyOpen, authOpen]);

  const targetSol = Number(campaign?.total_target_sol ?? 85);
  const graduated = campaign?.graduated !== false;

  const startBuy = (usd: number) => {
    setAmount(usd);
    if (!session) { setAuthOpen(true); return; }
    setBuyOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src={logoWhite} alt="Rhozeland" className="h-6 dark:invert-0 invert" />
            <span className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">$RHOZE</span>
          </a>
          <div className="flex items-center gap-3 text-xs">
            {session ? <span className="text-muted-foreground">{session.user.email}</span> : (
              <button onClick={() => setAuthOpen(true)} className="text-foreground underline underline-offset-4">Sign in</button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-14 space-y-12">
        {/* Hero */}
        <section>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-primary">
            <CheckCircle2 className="w-3.5 h-3.5" /> Graduated
          </div>
          <h1 className="mt-4 text-4xl md:text-6xl tracking-tight leading-[1.02] max-w-3xl">
            {campaign?.headline ?? "We graduated. Now own a piece."}
          </h1>
          <p className="mt-3 text-muted-foreground text-lg max-w-xl">
            Buy $RHOZE with a card at checkout. Every dollar also lands as Rhozeland credits — merch, studio time, app perks.
          </p>

          {/* Buy bar */}
          <div className="mt-7 rounded-2xl border border-border bg-card p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-2">
              {AMOUNTS.map((a) => (
                <button key={a} onClick={() => setAmount(a)}
                  className={`rounded-full border px-4 py-2 text-sm tabular-nums transition ${
                    amount === a ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50"
                  }`}>${a.toLocaleString()}</button>
              ))}
              <div className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5">
                <span className="text-muted-foreground text-sm">$</span>
                <input type="number" min={50} value={amount}
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-20 bg-transparent text-sm tabular-nums outline-none" />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {pickTier(amount) !== "supporter" && (
                  <span className="capitalize text-foreground">{pickTier(amount)} tier · </span>
                )}
                <span className="tabular-nums text-foreground">{Math.floor(amount * multFor(amount)).toLocaleString()}</span> credits at {multFor(amount).toFixed(2)}×
              </div>
              <Button size="lg" onClick={() => startBuy(amount)}>
                <CreditCard className="w-4 h-4 mr-2" /> Checkout with Square
              </Button>
            </div>
          </div>
        </section>

        {/* Graduation explainer */}
        <section className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-1 rounded-2xl border border-border bg-card p-5">
            <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Bonding curve</div>
            <div className="mt-2 text-3xl tabular-nums">{targetSol} / {targetSol} SOL</div>
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full w-full bg-primary" />
            </div>
            <div className="mt-2 text-xs text-primary">Complete · 100%</div>
          </div>
          <div className="md:col-span-2 rounded-2xl border border-border p-5 text-sm text-muted-foreground">
            <div className="text-foreground text-sm font-medium mb-2">What graduating means</div>
            <ul className="space-y-1.5">
              <li className="flex gap-2"><Check className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />The launch curve filled, so liquidity moved to a real market pool.</li>
              <li className="flex gap-2"><Check className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />$RHOZE now trades openly — price is set by the market, not a curve.</li>
              <li className="flex gap-2"><Check className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />Buying here is simply buying in — no goal to hit, no deadline.</li>
              <li className="flex gap-2"><Coins className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />{holders} holders through Rhozeland so far.</li>
            </ul>
          </div>
        </section>

        {/* Tiers, compact */}
        <section>
          <div className="grid md:grid-cols-3 gap-3">
            {TIERS.map((t) => (
              <button key={t.slug} onClick={() => startBuy(Math.max(t.min, t.slug === pickTier(amount) ? amount : t.min))}
                className={`text-left rounded-2xl border p-4 transition hover:border-primary/60 ${
                  pickTier(amount) === t.slug ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">${t.min.toLocaleString()}+</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{t.perk}</div>
              </button>
            ))}
          </div>
        </section>

        <section><WalletPanel session={session} /></section>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 text-xs text-muted-foreground flex flex-wrap gap-3 justify-between">
          <span>© 2026 Rhozeland · collab@rhozeland.com</span>
          <span>Not financial advice. Credits are non-transferable.</span>
        </div>
      </footer>

      <BuyDialog
        open={buyOpen}
        onOpenChange={setBuyOpen}
        initialAmount={amount}
        squareUrl={campaign?.square_checkout_url ?? null}
        session={session}
        onCreated={() => { loadHolders(); }}
      />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen}
        onSignedIn={() => { setAuthOpen(false); setBuyOpen(true); }} />
    </div>
  );
}

// ─── Buy dialog ───────────────────────────────────────────────────────────
function BuyDialog({
  open, onOpenChange, initialAmount, squareUrl, session, onCreated,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; initialAmount: number;
  squareUrl: string | null; session: Session | null; onCreated: () => void;
}) {
  const [amount, setAmount] = useState(initialAmount);
  const [lockMonths, setLockMonths] = useState(0);
  const [payment, setPayment] = useState<PayMethod>("square");
  const [wallet, setWallet] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ref: string } | null>(null);
  const [credited, setCredited] = useState<{ credits: number; balance: number } | null>(null);

  useEffect(() => { if (open) { setAmount(initialAmount); setDone(null); setCredited(null); } }, [open, initialAmount]);

  const isSquare: boolean = payment === "square";
  const base = multFor(amount);
  const totalMult = Number((base + (LOCK_BONUS[lockMonths] ?? 0)).toFixed(2));
  const fee = Math.round(amount * 0.07);
  const credits = Math.floor(amount * totalMult);
  const total = amount + fee;

  const submit = async () => {
    if (!session) return;
    if (amount < 50) { toast({ title: "Minimum is $50" }); return; }
    setBusy(true);
    try {
      if (payment === "square") {
        const { data, error } = await (supabase.rpc as any)("purchase_rhoze_square", {
          _amount_usd_cents: amount * 100,
          _lock_months: lockMonths,
          _solana_wallet: wallet.trim() || undefined,
          _notes: notes.trim() || undefined,
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.pledge_id) {
          supabase.functions.invoke("notify-new-pledge", { body: { pledgeId: row.pledge_id } })
            .catch((e) => console.warn("notify-new-pledge failed", e));
        }
        setCredited({ credits: Number(row?.credits_awarded ?? 0), balance: Number(row?.new_balance ?? 0) });
        setDone({ ref: String(row?.pledge_id ?? "").slice(0, 8).toUpperCase() });
        onCreated();
        if (squareUrl) window.open(squareUrl, "_blank", "noopener");
        return;
      }
      const { data: pledgeId, error } = await supabase.rpc("create_investor_pledge", {
        _amount_usd_cents: amount * 100,
        _lock_months: lockMonths,
        _path: "assisted",
        _payment_method: payment,
        _solana_wallet: wallet.trim() || undefined,
        _notes: notes.trim() || undefined,
      });
      if (error) throw error;
      if (pledgeId) {
        supabase.functions.invoke("notify-new-pledge", { body: { pledgeId } })
          .catch((e) => console.warn("notify-new-pledge failed", e));
      }
      setDone({ ref: String(pledgeId ?? "").slice(0, 8).toUpperCase() });
      onCreated();
      // non-square methods stay pending until settlement
    } catch (e) {
      toast({ title: "Couldn't place order", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {done ? (
          <div className="text-center py-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="mt-4">You're in the cohort</DialogTitle>
            <DialogDescription className="mt-1">
              Order <span className="font-mono">#{done.ref}</span> —{" "}
              {credited
                ? `${credited.credits.toLocaleString()} credits added to your account.`
                : `${credits.toLocaleString()} credits pending.`}
            </DialogDescription>
            {credited && (
              <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
                <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">New balance</div>
                <div className="mt-1 text-2xl tabular-nums">{credited.balance.toLocaleString()} $RHOZE</div>
              </div>
            )}
            {isSquare && (
              <p className="mt-3 text-xs text-muted-foreground">
                {squareUrl
                  ? "Square checkout opened in a new tab — finish the card payment to complete your order."
                  : "We'll send your Square payment link by email within 24h."}
              </p>
            )}
            {squareUrl && isSquare && (
              <Button className="mt-4 w-full" onClick={() => window.open(squareUrl, "_blank", "noopener")}>
                Reopen Square checkout
              </Button>
            )}
            <Button variant="outline" className="mt-2 w-full" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Buy $RHOZE</DialogTitle>
              <DialogDescription>We execute the buy for you. 7% service fee.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Amount (USD)</Label>
                <Input type="number" min={50} step={50} value={amount}
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Lock (optional)</Label>
                  <Select value={String(lockMonths)} onValueChange={(v) => setLockMonths(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No lock</SelectItem>
                      <SelectItem value="3">3 months (+10%)</SelectItem>
                      <SelectItem value="6">6 months (+20%)</SelectItem>
                      <SelectItem value="12">12 months (+35%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Pay with</Label>
                  <Select value={payment} onValueChange={(v) => setPayment(v as PayMethod)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="square">Square (card)</SelectItem>
                      <SelectItem value="etransfer">E-transfer</SelectItem>
                      <SelectItem value="sol">SOL</SelectItem>
                      <SelectItem value="usdc">USDC</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Solana wallet (optional)</Label>
                <Input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="For $RHOZE delivery" />
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-1.5 text-sm">
                <Row label="Buy amount" value={`$${amount.toLocaleString()}`} />
                <Row label="Service fee (7%)" value={`$${fee.toLocaleString()}`} />
                <Row label="Total" value={`$${total.toLocaleString()}`} bold />
                <Row label={`Credits (${totalMult.toFixed(2)}×)`} value={`${credits.toLocaleString()}`} />
              </div>
              <Button className="w-full" disabled={busy} onClick={submit}>
                {busy ? "Placing order…" : isSquare ? "Continue to Square" : "Place order"}
              </Button>
            </div>
          </>
        )}
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

// ─── Auth ─────────────────────────────────────────────────────────────────
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
          <DialogTitle>{mode === "in" ? "Sign in to buy" : "Create an account"}</DialogTitle>
          <DialogDescription>Your orders, credits, and $RHOZE live in one place.</DialogDescription>
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
