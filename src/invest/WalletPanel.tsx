// /invest — WalletPanel
// Paste any Solana wallet address to see SOL + $RHOZE holdings, USD value,
// live market data (DexScreener), Solscan deep links, and a lightweight
// price chart. Signed-in users can save the address to their profile so it
// auto-loads on return visits.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import type { Session } from "@supabase/supabase-js";
import { ArrowUpRight, ExternalLink, Loader2, Save, Search, Wallet, X } from "lucide-react";

type Lookup = {
  address: string;
  solscan: string;
  sol: { balance: number };
  rhoze: { mint: string; balance: number; priceUsd: number; valueUsd: number; change24h: number | null };
  market: {
    priceUsd: number; change24h: number | null; liquidityUsd: number | null;
    fdvUsd: number | null; volume24h: number | null; pairUrl: string;
  };
  recent: { signature: string; blockTime: number | null; err: unknown; solscan: string }[];
  source: string;
};

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);
const fmtUsd = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString()}` : `$${n.toFixed(n >= 1 ? 2 : 6)}`;
const fmtNum = (n: number, d = 2) =>
  n.toLocaleString(undefined, { maximumFractionDigits: d });

export default function WalletPanel({ session }: { session: Session | null }) {
  const [addr, setAddr] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Lookup | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Load saved wallet from profile
  useEffect(() => {
    if (!session) { setSaved(null); return; }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("solana_wallet")
        .eq("id", session.user.id)
        .maybeSingle();
      const w = (data as any)?.solana_wallet as string | null;
      if (w) { setSaved(w); setAddr(w); void lookup(w); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const lookup = async (address: string) => {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.functions.invoke("wallet-lookup", { body: { address } });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if ((data as any)?.error) { setErr((data as any).error); return; }
    setData(data as Lookup);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = addr.trim();
    if (v.length < 32 || v.length > 44) { setErr("That doesn't look like a Solana address."); return; }
    void lookup(v);
  };

  const saveToProfile = async () => {
    if (!session || !data) return;
    const { error } = await supabase.from("profiles")
      .update({ solana_wallet: data.address })
      .eq("id", session.user.id);
    if (error) { toast({ title: "Couldn't save", description: error.message, variant: "destructive" }); return; }
    setSaved(data.address);
    toast({ title: "Wallet saved to your profile" });
  };

  const clearFromProfile = async () => {
    if (!session) return;
    const { error } = await supabase.from("profiles")
      .update({ solana_wallet: null })
      .eq("id", session.user.id);
    if (error) { toast({ title: "Couldn't clear", description: error.message, variant: "destructive" }); return; }
    setSaved(null);
    toast({ title: "Removed from profile" });
  };

  const totalUsd = useMemo(() => (data ? data.rhoze.valueUsd : 0), [data]);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
            <Wallet className="w-3 h-3" /> Wallet lookup
          </div>
          <h2 className="text-xl md:text-2xl tracking-tight mt-1">See any wallet on Solscan + $RHOZE</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Paste a Solana address to view SOL, $RHOZE holdings, live price, and recent activity. We never take custody — this is read-only.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2">
        <Input
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          placeholder="Solana address (e.g. 7khG…pump)"
          className="font-mono text-sm"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
        <Button type="submit" disabled={busy || !addr.trim()}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="ml-1.5">Look up</span>
        </Button>
      </form>
      {err && <div className="mt-2 text-xs text-red-600 dark:text-red-400">{err}</div>}

      {data && (
        <div className="mt-6 space-y-5">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <code className="px-2 py-1 rounded-md bg-muted font-mono">{short(data.address)}</code>
            <a href={data.solscan} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-foreground underline underline-offset-4">
              Solscan <ExternalLink className="w-3 h-3" />
            </a>
            <a href={data.market.pairUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              DexScreener <ExternalLink className="w-3 h-3" />
            </a>
            {session && (
              saved === data.address ? (
                <button onClick={clearFromProfile} className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" /> Saved — remove
                </button>
              ) : (
                <button onClick={saveToProfile} className="ml-auto inline-flex items-center gap-1 text-foreground underline underline-offset-4">
                  <Save className="w-3 h-3" /> Save to my profile
                </button>
              )
            )}
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="$RHOZE balance" value={fmtNum(data.rhoze.balance, 0)} sub={fmtUsd(totalUsd)} />
            <Stat label="SOL balance" value={`${fmtNum(data.sol.balance, 3)} SOL`} />
            <Stat label="$RHOZE price" value={fmtUsd(data.market.priceUsd)}
              sub={data.market.change24h != null
                ? `${data.market.change24h >= 0 ? "▲" : "▼"} ${Math.abs(data.market.change24h).toFixed(2)}% 24h`
                : undefined}
              tone={data.market.change24h != null ? (data.market.change24h >= 0 ? "up" : "down") : undefined} />
            <Stat label="Market cap (FDV)" value={data.market.fdvUsd ? fmtUsd(data.market.fdvUsd) : "—"}
              sub={data.market.volume24h ? `${fmtUsd(data.market.volume24h)} vol 24h` : undefined} />
          </div>

          {/* Chart embed */}
          <div className="rounded-xl border border-border overflow-hidden bg-background">
            <iframe
              title="$RHOZE live chart"
              src={`https://dexscreener.com/solana/C4rRvr1GCNEeYHwA6MaSbgyckY7671Rq3X4yfeGm4rmF?embed=1&theme=dark&trades=0&info=0`}
              className="w-full h-[360px] block"
              loading="lazy"
            />
          </div>

          {/* Recent activity */}
          {data.recent.length > 0 && (
            <div>
              <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground mb-2">Recent activity</div>
              <ul className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                {data.recent.slice(0, 8).map((t) => (
                  <li key={t.signature} className="flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/30">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${t.err ? "bg-red-500" : "bg-emerald-500"}`} />
                      <code className="font-mono truncate">{short(t.signature)}</code>
                      <span className="text-muted-foreground shrink-0">
                        {t.blockTime ? new Date(t.blockTime * 1000).toLocaleString() : "—"}
                      </span>
                    </div>
                    <a href={t.solscan} target="_blank" rel="noopener"
                      className="text-foreground inline-flex items-center gap-1 shrink-0">
                      View <ArrowUpRight className="w-3 h-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[10px] text-muted-foreground">
            Data via {data.source === "helius" ? "Helius" : "public Solana RPC"} + DexScreener. Read-only — pasting an address never grants us access.
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  const toneCls =
    tone === "up" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "down" ? "text-red-600 dark:text-red-400"
    : "text-muted-foreground";
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg tabular-nums leading-tight">{value}</div>
      {sub && <div className={`text-[11px] tabular-nums mt-0.5 ${toneCls}`}>{sub}</div>}
    </div>
  );
}