// Auto-provisions a custodial Solana wallet for signed-in users, and lets
// them swap in their own address. Display-only for now — outbound transfers
// are gated behind a proper key-management pass.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Coins, Copy, KeyRound, Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

type Wallet = { pubkey: string; is_custodial: boolean };

export default function WalletSlot({ session }: { session: Session | null }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [replacing, setReplacing] = useState(false);
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) { setWallet(null); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Try view first
      const { data: existing } = await supabase
        .from("user_wallet_pubkeys")
        .select("pubkey,is_custodial")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (existing && !cancelled) {
        setWallet({ pubkey: existing.pubkey, is_custodial: existing.is_custodial });
        setLoading(false);
        return;
      }
      // Provision one
      const { data, error } = await supabase.functions.invoke("wallet-provision", { body: {} });
      if (cancelled) return;
      if (error || !data?.pubkey) {
        toast({ title: "Couldn't set up your wallet", description: error?.message ?? "Try again shortly.", variant: "destructive" });
      } else {
        setWallet({ pubkey: data.pubkey, is_custodial: !!data.is_custodial });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const short = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;
  const copy = () => {
    if (!wallet) return;
    navigator.clipboard.writeText(wallet.pubkey);
    toast({ title: "Address copied" });
  };

  const submitExternal = async () => {
    const v = addr.trim();
    if (v.length < 32 || v.length > 44) {
      toast({ title: "Doesn't look like a Solana address", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("wallet-replace-external", { body: { pubkey: v } });
    setBusy(false);
    if (error || !data?.pubkey) {
      toast({ title: "Couldn't replace wallet", description: error?.message ?? data?.error, variant: "destructive" });
    } else {
      setWallet({ pubkey: data.pubkey, is_custodial: false });
      setReplacing(false);
      setAddr("");
      toast({ title: "Wallet replaced" });
    }
  };

  if (!session) return null;
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Setting up your Rhoze wallet…
      </div>
    );
  }
  if (!wallet) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <Coins className="w-3 h-3" />
            {wallet.is_custodial ? "Rhoze Wallet · managed for you" : "External wallet"}
          </div>
          <div className="mt-1 font-mono text-sm truncate">{short(wallet.pubkey)}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            $RHOZE accrual only for now. Outbound transfers coming after security review.
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={copy}>
            <Copy className="w-3 h-3 mr-1" /> Copy
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setReplacing((r) => !r)}>
            <KeyRound className="w-3 h-3 mr-1" /> {replacing ? "Cancel" : "Use my own"}
          </Button>
        </div>
      </div>
      {replacing && (
        <div className="mt-3 flex gap-2">
          <Input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Your Solana address (base58)" className="text-xs" />
          <Button size="sm" onClick={submitExternal} disabled={busy}>
            {busy ? "…" : "Replace"}
          </Button>
        </div>
      )}
    </div>
  );
}