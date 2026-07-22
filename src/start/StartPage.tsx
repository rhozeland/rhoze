// Studio Concierge - copilot-first /start page.
// Guest-friendly AI-guided project scoping. Sign-in optional.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import logoWhite from "@/assets/logo-white.webp";
import CopilotChat from "@/start/CopilotChat";
import CopilotBrief from "@/start/CopilotBrief";
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

export default function StartPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [convo, setConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [continueOpen, setContinueOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
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
    <div className="min-h-screen bg-[hsl(45_35%_97%)] text-neutral-900" style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 300 }}>
      <header className="border-b border-neutral-200/70 bg-white/40 backdrop-blur">
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
        <div className="mb-6 md:mb-8">
          <div className="text-[11px] tracking-[0.25em] uppercase text-neutral-500 mb-1">Start a project</div>
          <h1 className="text-2xl md:text-4xl tracking-tight text-neutral-900">
            Talk it through. We'll scope it together.
          </h1>
          <p className="mt-2 text-neutral-500 max-w-xl text-sm md:text-base">
            Describe what you're making - the concierge asks the right questions, builds a brief, and points you to the right pathway. No login needed to start.
          </p>
        </div>

        {loading || !convo ? (
          <div className="rounded-2xl border border-neutral-200 bg-white/60 p-10 text-center text-neutral-500 text-sm">
            Warming up...
          </div>
        ) : (
          <div className="grid md:grid-cols-[1fr_340px] gap-4 md:gap-6 min-h-[600px] md:h-[calc(100vh-220px)]">
            <CopilotChat
              conversation={convo}
              guestToken={guestToken}
              initialMessages={messages}
              onBriefUpdate={refreshBrief}
            />
            <CopilotBrief conversation={convo} onContinue={() => setContinueOpen(true)} />
          </div>
        )}
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