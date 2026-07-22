// Studio Concierge - warm minimalist grid.
// Click-to-launch Subscribe/Build tiles, $RHOZE loyalty chip + Solana wallet
// slot for future token airdrops, copilot chat below.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import logoWhite from "@/assets/logo-white.webp";
import CopilotChat from "@/start/CopilotChat";
import CopilotBrief from "@/start/CopilotBrief";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import {
  type Conversation,
  type CopilotMessage,
  getGuestToken,
  getOrCreateConversation,
  loadMessages,
  reloadConversation,
  submitCopilot,
} from "@/start/copilotClient";
import { toast } from "@/hooks/use-toast";
import type { Session } from "@supabase/supabase-js";
import { Sparkles, Rocket, Coins, ArrowRight, Loader2 } from "lucide-react";

export default function StartPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [convo, setConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [continueOpen, setContinueOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const guestToken = getGuestToken();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const c = await getOrCreateConversation();
        setConvo(c);
        const m = await loadMessages(c.id);
        setMessages(m);
      } catch (e) {
        toast({ title: "Couldn't start conversation", description: (e as Error).message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.user?.id]);

  const refreshBrief = useCallback(async () => {
    if (!convo) return;
    const c = await reloadConversation(convo.id);
    if (c) setConvo(c);
  }, [convo]);

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#4A4540]" style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 300 }}>
      <header className="border-b border-[#E8E4DE]/70 bg-white/40 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src={logoWhite} alt="Rhoze" className="h-6 invert" />
            <span className="text-[11px] tracking-[0.25em] uppercase text-neutral-500">Studio</span>
          </a>
          <div className="flex items-center gap-3 text-xs">
            {session ? (
              <>
                <span className="text-neutral-500 hidden sm:inline">{session.user.email}</span>
                <a href="/portal" className="text-neutral-900 underline underline-offset-4">Portal</a>
              </>
            ) : (
              <button onClick={() => setAuthOpen(true)} className="text-neutral-900 underline underline-offset-4">
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-[11px] tracking-[0.25em] uppercase text-neutral-500 mb-1">Start a project</div>
            <h1 className="text-2xl md:text-4xl tracking-tight text-[#4A4540]">
              Pick a pathway. Or just talk it through.
            </h1>
            <p className="mt-2 text-neutral-500 max-w-xl text-sm md:text-base">
              Subscribe for a monthly retainer, build a one-off with the concierge, or link a Solana wallet so future $RHOZE rewards land in your pocket.
            </p>
          </div>
          <LoyaltyRail
            session={session}
            onConnectWallet={() => (session ? setWalletOpen(true) : setAuthOpen(true))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 md:mb-8">
          <button
            onClick={() => document.getElementById("copilot-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="group text-left flex flex-col p-6 bg-[#F5F2ED] border border-[#E8E4DE] rounded-2xl hover:border-[#D8D4CE] transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mb-4 border border-[#E8E4DE]">
              <Sparkles className="w-5 h-5 opacity-70" strokeWidth={1.5} />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-normal">Build a project</h3>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-60 -translate-x-1 group-hover:translate-x-0 transition-all" />
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed mt-1">
              Scope a one-off with the concierge. Deposit, timeline, and team suggestions in-line.
            </p>
          </button>

          <button
            onClick={() => setSubscribeOpen(true)}
            className="group text-left flex flex-col p-6 bg-white border border-[#E8E4DE] rounded-2xl hover:border-[#D8D4CE] transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-[#F5F2ED] flex items-center justify-center mb-4 border border-[#E8E4DE]">
              <Rocket className="w-5 h-5 opacity-70" strokeWidth={1.5} />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-normal">Subscribe</h3>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-60 -translate-x-1 group-hover:translate-x-0 transition-all" />
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed mt-1">
              Monthly retainer. Credits refresh, priority queue, and $RHOZE yield on every dollar spent.
            </p>
          </button>
        </div>

        <div id="copilot-anchor" className="text-[11px] tracking-[0.25em] uppercase text-neutral-500 mb-3">
          Concierge · live scoping
        </div>
        {loading || !convo ? (
          <div className="rounded-2xl border border-[#E8E4DE] bg-white/60 p-10 text-center text-neutral-500 text-sm">
            Warming up...
          </div>
        ) : (
          <div className="grid md:grid-cols-[1fr_340px] gap-4 md:gap-6 min-h-[560px]">
            <CopilotChat
              conversation={convo}
              guestToken={guestToken}
              initialMessages={messages}
              onBriefUpdate={refreshBrief}
            />
            <CopilotBrief conversation={convo} onContinue={() => setContinueOpen(true)} />
          </div>
        )}

        <p className="text-center text-[11px] opacity-40 italic tracking-wide mt-6">
          Rhoze Copilot uses your conversation context to draft the brief.
        </p>
      </main>

      <ContinueDialog
        open={continueOpen}
        onOpenChange={setContinueOpen}
        conversation={convo}
        guestToken={guestToken}
        session={session}
      />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      <SubscribeDialog
        open={subscribeOpen}
        onOpenChange={setSubscribeOpen}
        session={session}
        onNeedAuth={() => { setSubscribeOpen(false); setAuthOpen(true); }}
      />
      <WalletDialog open={walletOpen} onOpenChange={setWalletOpen} session={session} />
    </div>
  );
}

// ---------- Loyalty rail (balance chip + wallet pill) ----------
function LoyaltyRail({ session, onConnectWallet }: { session: Session | null; onConnectWallet: () => void }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);

  useEffect(() => {
    if (!session) { setBalance(null); setWallet(null); return; }
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("solana_wallet").eq("id", session.user.id).maybeSingle();
      setWallet(prof?.solana_wallet ?? null);
      const { data: pcs } = await supabase.from("project_clients").select("project_id").eq("user_id", session.user.id);
      const ids = (pcs ?? []).map((r) => r.project_id);
      if (!ids.length) { setBalance(0); return; }
      const { data: bals } = await supabase.from("rhoze_balances").select("balance").in("project_id", ids);
      setBalance((bals ?? []).reduce((a, r) => a + Number(r.balance ?? 0), 0));
    })();
  }, [session?.user?.id]);

  const short = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-end">
        <span className="text-[10px] uppercase tracking-widest opacity-60">Loyalty balance</span>
        <span className="text-lg font-normal tabular-nums">
          {session ? (balance === null ? "…" : balance.toLocaleString()) : "—"} <span className="text-xs text-neutral-500">$RHOZE</span>
        </span>
      </div>
      <button
        onClick={onConnectWallet}
        className="px-4 py-2 border border-[#E8E4DE] rounded-full text-xs hover:bg-[#F5F2ED] transition-colors flex items-center gap-2"
        title={wallet ?? "Link a Solana wallet for future $RHOZE airdrops"}
      >
        <Coins className="w-3.5 h-3.5 opacity-60" strokeWidth={1.5} />
        {wallet ? short(wallet) : "Connect Solana wallet"}
      </button>
    </div>
  );
}

// ---------- Subscribe dialog (loads active subscription packages) ----------
function SubscribeDialog({
  open, onOpenChange, session, onNeedAuth,
}: { open: boolean; onOpenChange: (o: boolean) => void; session: Session | null; onNeedAuth: () => void }) {
  const [tiers, setTiers] = useState<any[] | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSlug(null);
    (async () => {
      const { data } = await supabase
        .from("service_packages")
        .select("id,slug,name,description,price_cents,credits,billing_interval,sort_order")
        .eq("kind", "subscription")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      setTiers(data ?? []);
    })();
  }, [open]);

  const startCheckout = (chosen: string) => {
    if (!session) { onNeedAuth(); return; }
    setSlug(chosen);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Subscribe to Rhoze</DialogTitle>
          <DialogDescription>Monthly credits, priority queue, and $RHOZE yield on every dollar spent.</DialogDescription>
        </DialogHeader>
        {slug ? (
          <div className="min-h-[520px]">
            <StripeEmbeddedCheckout
              subscriptionSlug={slug}
              customerEmail={session?.user?.email}
              userId={session?.user?.id}
              returnUrl={`${window.location.origin}/start.html?checkout=return`}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {tiers === null && (
              <div className="col-span-full flex items-center justify-center py-10 text-neutral-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading tiers…
              </div>
            )}
            {tiers && tiers.length === 0 && (
              <div className="col-span-full text-center py-10 text-neutral-500 text-sm">
                No subscription tiers are published yet. Ping the team.
              </div>
            )}
            {(tiers ?? []).map((t) => (
              <div key={t.id} className="rounded-2xl border border-[#E8E4DE] p-5 flex flex-col bg-white">
                <div className="text-[11px] uppercase tracking-widest text-neutral-500">{t.billing_interval ?? "month"}</div>
                <div className="text-lg mt-1">{t.name}</div>
                <div className="text-2xl mt-2 tabular-nums">${((t.price_cents ?? 0) / 100).toFixed(0)}<span className="text-sm text-neutral-500">/mo</span></div>
                <div className="text-xs text-neutral-500 mt-1">{t.credits ?? 0} credits / mo</div>
                {t.description && <p className="text-xs text-neutral-500 mt-3 leading-relaxed flex-1">{t.description}</p>}
                <Button onClick={() => startCheckout(t.slug)} className="mt-4 bg-[#4A4540] hover:bg-black text-white">
                  Choose {t.name}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Solana wallet dialog ----------
function WalletDialog({ open, onOpenChange, session }: { open: boolean; onOpenChange: (o: boolean) => void; session: Session | null }) {
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !session) return;
    supabase.from("profiles").select("solana_wallet").eq("id", session.user.id).maybeSingle()
      .then(({ data }) => setAddr(data?.solana_wallet ?? ""));
  }, [open, session?.user?.id]);

  const save = async () => {
    if (!session) return;
    const v = addr.trim();
    if (v && (v.length < 32 || v.length > 44)) {
      toast({ title: "Doesn't look like a Solana address", description: "Should be 32–44 characters.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ solana_wallet: v || null }).eq("id", session.user.id);
    setBusy(false);
    if (error) toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    else { toast({ title: v ? "Wallet linked" : "Wallet removed" }); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link your Solana wallet</DialogTitle>
          <DialogDescription>
            Save the address where future $RHOZE airdrops should land. You earn $RHOZE for every dollar spent with Rhoze — payouts to wallets roll out soon.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label className="text-xs">Solana address</Label>
          <Input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="e.g. 5F...JkR (base58)" />
          <Button onClick={save} disabled={busy} className="w-full bg-[#4A4540] hover:bg-black text-white">
            {busy ? "Saving…" : "Save wallet"}
          </Button>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            We don't touch your keys or take custody. This is a display + payout address only.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContinueDialog({
  open, onOpenChange, conversation, guestToken, session,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conversation: Conversation | null;
  guestToken: string;
  session: Session | null;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(session?.user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { if (session?.user?.email) setEmail(session.user.email); }, [session]);

  const submit = async () => {
    if (!conversation) return;
    if (!name.trim() || !email.trim()) {
      toast({ title: "Name and email required" });
      return;
    }
    setBusy(true);
    try {
      await submitCopilot({
        conversationId: conversation.id,
        guestToken,
        contactName: name.trim(),
        contactEmail: email.trim(),
        contactPhone: phone.trim() || undefined,
      });
      setDone(true);
    } catch (e) {
      toast({ title: "Couldn't submit", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{done ? "Sent to the team" : "Send this brief to Rhoze"}</DialogTitle>
          <DialogDescription>
            {done
              ? "We'll be in touch within 48 hours. You can keep chatting to refine anything."
              : "Add your contact so the team can reach out. No account needed."}
          </DialogDescription>
        </DialogHeader>
        {!done && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" />
            </div>
            <div>
              <Label className="text-xs">Phone (optional)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1..." />
            </div>
            <Button onClick={submit} disabled={busy} className="w-full bg-neutral-900 hover:bg-neutral-800 text-white">
              {busy ? "Sending..." : "Send brief"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AuthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
    else onOpenChange(false);
  };

  const google = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/start.html" },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
          <DialogDescription>Save your conversation and access your dashboard.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button onClick={signIn} disabled={busy} className="w-full bg-neutral-900 hover:bg-neutral-800 text-white">
            {busy ? "..." : "Sign in"}
          </Button>
          <div className="text-center text-[11px] uppercase tracking-wider text-neutral-400">or</div>
          <Button variant="outline" onClick={google} className="w-full">Continue with Google</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}