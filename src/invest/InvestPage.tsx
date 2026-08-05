// /invest — $RHOZE has graduated. Simple buy flow: pick an amount, checkout
// with Square (our POS), and the order lands in your account dashboard.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import type { Session } from "@supabase/supabase-js";
import { Calculator, CreditCard, Sparkles } from "lucide-react";
import logoWhite from "@/assets/logo-white.webp";
import WalletPanel from "./WalletPanel";

type Tier = "supporter" | "builder" | "core";
const TIERS: { slug: Tier; label: string; min: number; mult: number; perk: string }[] = [
  { slug: "supporter", label: "Supporter", min: 50, mult: 1.0, perk: "1:1 credits + early merch drops" },
  { slug: "builder", label: "Builder", min: 500, mult: 1.15, perk: "+15% credits, priority studio booking" },
  { slug: "core", label: "Core", min: 2000, mult: 1.4, perk: "+40% credits, named slot, governance weight" },
];

const FEE_PCT = 0.05;   // Rhozeland handles the on-chain buy for you
const HST_PCT = 0.13;   // HST applies to the purchase amount
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function quote(amount: number) {
  const fee = amount * FEE_PCT;
  const hst = amount * HST_PCT;
  return { fee, hst, total: amount + fee + hst };
}

const pickTier = (usd: number): Tier => (usd >= 2000 ? "core" : usd >= 500 ? "builder" : "supporter");
const multFor = (usd: number) => TIERS.find((t) => t.slug === pickTier(usd))!.mult;

// Live $RHOZE price (USD) from the graduated pool, converted to CAD.
const RHOZE_POOL = "AjCpwQxLsW3SbueGUD2sKpGbbtUPNt64JPcSBJ2uuUiJ";
const GT_POOL = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${RHOZE_POOL}`;
const CAD_PER_USD = 1.37;

export default function InvestPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [session, setSession] = useState<Session | null>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [holders, setHolders] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [amount, setAmount] = useState(250);
  const [rhozeCad, setRhozeCad] = useState<number | null>(null);

  useEffect(() => {
    fetch(GT_POOL)
      .then((r) => r.json())
      .then((j) => {
        const p = Number(j?.data?.attributes?.base_token_price_usd);
        if (p > 0) setRhozeCad(p * CAD_PER_USD);
      })
      .catch(() => { /* price optional */ });
  }, []);

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
    <div className={embedded ? "text-foreground" : "min-h-screen bg-background text-foreground"}>
      {!embedded && <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
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
      </header>}

      <main className={embedded ? "space-y-6" : "max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-14 space-y-12"}>
        {/* Buy — one input, clear total */}
        <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
                <Calculator className="h-3.5 w-3.5" /> Purchase calculator
              </div>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                Enter any amount. Your handling fee and HST are calculated instantly.
              </p>
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums">{holders} holders through Rhozeland</span>
          </div>

          <div className="mt-5 grid md:grid-cols-[minmax(0,1fr)_300px] gap-4 items-stretch">
            <div>
              <Label htmlFor="rhoze-amount" className="text-xs">Amount to buy (CAD)</Label>
              <div className="mt-1 flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 focus-within:ring-2 focus-within:ring-ring">
                <span className="text-xl text-muted-foreground">$</span>
                <input type="number" min={20} step={10} value={amount}
                  id="rhoze-amount"
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-transparent text-3xl tabular-nums outline-none" />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className={amount > 0 && amount < 20 ? "text-destructive" : "opacity-0 select-none"} aria-live="polite">
                  Minimum $20 CAD
                </span>
                <span>{Math.floor(amount * multFor(amount)).toLocaleString()} credits · {multFor(amount).toFixed(2)}× rate</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col text-sm">
              <div className="rounded-lg bg-background border border-border px-3 py-2.5">
                <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">You receive (est.)</div>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-xl leading-none tabular-nums font-medium">
                    {rhozeCad ? `≈ ${Math.floor(amount / rhozeCad).toLocaleString()}` : "—"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">$RHOZE</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <Row label="$RHOZE purchase" value={`$${money(amount)}`} />
                <Row label="Service fee (5%)" value={`$${money(quote(amount).fee)}`} />
                <Row label="HST (13%)" value={`$${money(quote(amount).hst)}`} />
              </div>
              <div className="border-t border-border pt-2 mt-2">
                <Row label="Total due" value={`$${money(quote(amount).total)}`} bold />
              </div>
              {rhozeCad && (
                <div className="text-[11px] leading-snug text-muted-foreground pt-2 mt-auto">
                  Live price ≈ ${rhozeCad.toFixed(8)} CAD / $RHOZE · final amount set at fill
                </div>
              )}
            </div>
          </div>
          <Button size="lg" className="mt-4 w-full" onClick={() => startBuy(amount)} disabled={amount < 20}>
            <CreditCard className="w-4 h-4 mr-2" /> Pay ${money(quote(amount).total)} CAD with Square
          </Button>
        </section>

        {/* Chart + market stats + on-chain activity */}
        <section><WalletPanel session={session} /></section>
      </main>

      {!embedded && <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 text-xs text-muted-foreground flex flex-wrap gap-3 justify-between">
          <span>© 2026 Rhozeland · collab@rhozeland.com</span>
          <span>Not financial advice. Credits are non-transferable.</span>
        </div>
      </footer>}

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
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ref: string } | null>(null);
  const [credited, setCredited] = useState<{ credits: number; balance: number } | null>(null);

  useEffect(() => { if (open) { setAmount(initialAmount); setDone(null); setCredited(null); } }, [open, initialAmount]);

  const credits = Math.floor(amount * multFor(amount));
  const q = quote(amount);

  const submit = async () => {
    if (!session) return;
    if (amount < 20) { toast({ title: "Minimum is $20 CAD" }); return; }
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("purchase_rhoze_square", {
        _amount_usd_cents: amount * 100,
        _lock_months: 0,
        _solana_wallet: undefined,
        _notes: undefined,
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
            <p className="mt-3 text-xs text-muted-foreground">
              {squareUrl
                ? "Square checkout opened in a new tab — finish the card payment to complete your order."
                : "We'll send your Square payment link by email within 24h."}
            </p>
            {squareUrl && (
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
              <DialogDescription>Review the calculated total, then continue to Square.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-1.5 text-sm">
                <Row label="$RHOZE purchase" value={`$${money(amount)}`} />
                <Row label="Service fee (5%)" value={`$${money(q.fee)}`} />
                <Row label="HST (13%)" value={`$${money(q.hst)}`} />
                <Row label="Total due" value={`$${money(q.total)}`} bold />
                <Row label={`Credits (${multFor(amount).toFixed(2)}×)`} value={`${credits.toLocaleString()}`} />
              </div>
              <Button className="w-full" disabled={busy} onClick={submit}>
                {busy ? "Preparing checkout…" : `Continue to Square · $${money(q.total)} CAD`}
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
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground whitespace-nowrap">{label}</span>
      <span className={`tabular-nums text-right whitespace-nowrap ${bold ? "font-medium text-foreground" : ""}`}>{value}</span>
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
