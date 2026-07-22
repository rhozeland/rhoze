// Start page — signed-in shows the embedded client dashboard + inline subscribe.
// Signed-out shows a form-first concierge (unlocks 5 AI turns after email) +
// inline branded subscribe. Custodial Rhoze Wallet auto-provisions on sign-in.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import logoWhite from "@/assets/logo-white.webp";
import CopilotChat from "@/start/CopilotChat";
import CopilotBrief from "@/start/CopilotBrief";
import ClientDashboard from "@/start/ClientDashboard";
import ConciergeForm from "@/start/ConciergeForm";
import SubscribeSection from "@/start/SubscribeSection";
import WalletSlot from "@/start/WalletSlot";
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
import { ArrowRight, Coins } from "lucide-react";

export default function StartPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [convo, setConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [continueOpen, setContinueOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [rhozeBalance, setRhozeBalance] = useState<number | null>(null);
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

  useEffect(() => {
    if (!session) { setRhozeBalance(null); return; }
    (async () => {
      const { data: pcs } = await supabase.from("project_clients").select("project_id").eq("user_id", session.user.id);
      const ids = (pcs ?? []).map((r) => r.project_id);
      if (!ids.length) { setRhozeBalance(0); return; }
      const { data: bals } = await supabase.from("rhoze_balances").select("balance").in("project_id", ids);
      setRhozeBalance((bals ?? []).reduce((a, r) => a + Number(r.balance ?? 0), 0));
    })();
  }, [session?.user?.id]);

  const refreshBrief = useCallback(async () => {
    if (!convo) return;
    const c = await reloadConversation(convo.id);
    if (c) setConvo(c);
  }, [convo]);

  const conciergeUnlocked = !!(convo as any)?.email_captured_at || !!session;
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src={logoWhite} alt="Rhoze" className="h-6 dark:invert-0 invert" />
            <span className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Studio</span>
          </a>
          <div className="flex items-center gap-3 text-xs">
            {session && (
              <span className="hidden sm:flex items-center gap-1 text-muted-foreground">
                <Coins className="w-3 h-3" />
                <span className="tabular-nums text-foreground">{rhozeBalance?.toLocaleString() ?? "…"}</span> $RHOZE
              </span>
            )}
            {session ? (
              <a href="/portal" className="text-foreground underline underline-offset-4">Portal</a>
            ) : (
              <button onClick={() => setAuthOpen(true)} className="text-foreground underline underline-offset-4">
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-10">
        {session ? (
          <>
            {/* Signed-in: dashboard on top, quick strip, then subscribe */}
            <section>
              <div className="grid md:grid-cols-[1fr_340px] gap-4 mb-4 items-start">
                <div>
                  <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground mb-1">Your studio</div>
                  <h1 className="text-2xl md:text-3xl tracking-tight">Welcome back.</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Everything on your projects, plus a fresh brief or subscription anytime.
                  </p>
                </div>
                <WalletSlot session={session} />
              </div>
              <ClientDashboard />
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Start something new</div>
                  <h2 className="text-lg mt-1">Brief a project or top up your plan</h2>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => scrollTo("concierge")}>
                    New project brief <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                  <Button onClick={() => scrollTo("subscribe")}>
                    Manage subscription <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section>
            <div className="max-w-2xl">
              <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground mb-1">Start a project</div>
              <h1 className="text-2xl md:text-4xl tracking-tight">
                Scope it in a form. Refine it with the concierge.
              </h1>
              <p className="mt-2 text-muted-foreground text-sm md:text-base">
                Free scoping — no account needed. Drop the basics, unlock 5 AI concierge turns to sharpen the brief, then send it to the team.
              </p>
            </div>
          </section>
        )}

        {/* Concierge — form-first for guests, chat for unlocked or signed-in */}
        <section id="concierge" className="scroll-mt-16">
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground mb-3">
            Concierge · {conciergeUnlocked ? "live scoping" : "structured brief"}
          </div>
          {loading || !convo ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground text-sm">
              Warming up…
            </div>
          ) : !conciergeUnlocked ? (
            <ConciergeForm
              conversation={convo}
              onUnlocked={async () => {
                const c = await reloadConversation(convo.id);
                if (c) setConvo(c);
                const m = await loadMessages(convo.id);
                setMessages(m);
              }}
            />
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
        </section>

        <SubscribeSection session={session} onNeedAuth={() => setAuthOpen(true)} />
      </main>

      <ContinueDialog
        open={continueOpen}
        onOpenChange={setContinueOpen}
        conversation={convo}
        guestToken={guestToken}
        session={session}
      />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
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