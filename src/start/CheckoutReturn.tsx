import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check } from "lucide-react";

type Outcome = { project_id: string | null; project_code: string | null; contact_email: string | null; kind: string };

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [polling, setPolling] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sessionId) { setPolling(false); return; }
    let cancelled = false;
    let attempt = 0;
    const poll = async () => {
      attempt += 1;
      const { data } = await supabase.rpc("get_checkout_outcome", { _session_id: sessionId });
      if (cancelled) return;
      const row = (data as Outcome[] | null)?.[0] ?? null;
      if (row?.project_code) {
        setOutcome(row); setPolling(false); return;
      }
      if (attempt < 12) { setTimeout(poll, 2000); }
      else { setPolling(false); setOutcome(row); }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rhozeland</div>
          <h1 className="text-2xl font-semibold">Checkout cancelled</h1>
          <p className="text-sm text-muted-foreground">No charge was made. <a href="/start.html" className="underline">Start over</a>.</p>
          <a href="/" className="inline-block text-sm underline mt-4">Return home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rhozeland</div>
        <h1 className="text-2xl font-semibold">Payment received — thank you.</h1>

        {outcome?.project_code ? (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3 text-left">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Your project code</div>
            <button
              onClick={() => copy(outcome.project_code!)}
              className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-base font-mono hover:border-primary/50 transition-colors"
            >
              <span>{outcome.project_code}</span>
              {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} className="text-muted-foreground" />}
            </button>
            <p className="text-xs text-muted-foreground">
              Save this code. Create a free account, then redeem it to access your project portal — see invoices, manage your subscription, and track credits.
            </p>
            <a href="/team.html#/client?code=" onClick={(e) => { e.preventDefault(); window.location.href = `/team.html#/client?code=${encodeURIComponent(outcome.project_code!)}`; }} className="block text-center bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium">
              Open client portal
            </a>
          </div>
        ) : polling ? (
          <p className="text-sm text-muted-foreground">Setting up your project… this takes a few seconds.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your project is being created. We'll email you within one business day with your project code and next steps.
          </p>
        )}

        <p className="text-xs text-muted-foreground">Reference: <code className="font-mono">{sessionId.slice(0, 18)}…</code></p>
        <a href="/" className="inline-block text-sm underline mt-2">Return home</a>
      </div>
    </div>
  );
}