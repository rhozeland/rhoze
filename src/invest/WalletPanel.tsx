// /invest — WalletPanel
// Paste any Solana wallet address to see SOL + $RHOZE holdings, USD value,
// live market data (Birdeye), Solscan deep links, and a lightweight
// price chart. Signed-in users can save the address to their profile so it
// auto-loads on return visits.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import type { Session } from "@supabase/supabase-js";
import { ArrowUpRight, ExternalLink, Loader2, Save, Search, Wallet, X } from "lucide-react";

const RHOZE_MINT = "7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump";
const RHOZE_BIRDEYE_URL = `https://birdeye.so/token/${RHOZE_MINT}?chain=solana`;
const RHOZE_BIRDEYE_WIDGET = `https://birdeye.so/tv-widget/${RHOZE_MINT}?chain=solana&viewMode=pair&chartInterval=15&chartType=CANDLE&theme=dark`;
const RHOZE_POOL = "AjCpwQxLsW3SbueGUD2sKpGbbtUPNt64JPcSBJ2uuUiJ";
const GT_POOL = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${RHOZE_POOL}`;

type Market = { price: number; change24h: number | null; fdv: number | null; liq: number | null; vol24h: number | null };
type Trade = { id: string; kind: string; usd: number; amount: number; at: string; tx: string };

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
  const [market, setMarket] = useState<Market | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);

  // Live market + on-chain trades for $RHOZE (public, no key needed)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(GT_POOL, { cache: "no-store" });
        const j = await r.json();
        const a = j?.data?.attributes;
        if (alive && a) {
          setMarket({
            price: Number(a.base_token_price_usd ?? 0),
            change24h: a.price_change_percentage?.h24 != null ? Number(a.price_change_percentage.h24) : null,
            fdv: a.fdv_usd ? Number(a.fdv_usd) : null,
            liq: a.reserve_in_usd ? Number(a.reserve_in_usd) : null,
            vol24h: a.volume_usd?.h24 ? Number(a.volume_usd.h24) : null,
          });
        }
      } catch { /* ignore */ }
      try {
        const r = await fetch(`${GT_POOL}/trades`, { cache: "no-store" });
        const j = await r.json();
        const rows: Trade[] = (j?.data ?? []).slice(0, 12).map((t: any) => ({
          id: t.id,
          kind: t.attributes?.kind ?? "trade",
          usd: Number(t.attributes?.volume_in_usd ?? 0),
          amount: Number(t.attributes?.from_token_amount ?? 0),
          at: t.attributes?.block_timestamp,
          tx: t.attributes?.tx_hash,
        }));
        if (alive) setTrades(rows);
      } catch { /* ignore */ }
    };
    load();
    const id = setInterval(load, 60000);
    return () => { alive = false; clearInterval(id); };
  }, []);

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
      {/* Always-on market view */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">$RHOZE · Live market</div>
        <div className="flex items-center gap-3 text-xs">
          <a href={RHOZE_BIRDEYE_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-foreground underline underline-offset-4">Birdeye <ExternalLink className="w-3 h-3" /></a>
          <a href={`https://solscan.io/token/${RHOZE_MINT}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">Solscan <ExternalLink className="w-3 h-3" /></a>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Price" value={market ? fmtUsd(market.price) : "—"}
          sub={market?.change24h != null ? `${market.change24h >= 0 ? "▲" : "▼"} ${Math.abs(market.change24h).toFixed(2)}% 24h` : undefined}
          tone={market?.change24h != null ? (market.change24h >= 0 ? "up" : "down") : undefined} />
        <Stat label="Market cap (FDV)" value={market?.fdv ? fmtUsd(market.fdv) : "—"} />
        <Stat label="Liquidity" value={market?.liq ? fmtUsd(market.liq) : "—"} />
        <Stat label="Volume 24h" value={market?.vol24h != null ? fmtUsd(market.vol24h) : "—"} />
      </div>
      <div className="mt-3 rounded-xl border border-border overflow-hidden bg-background">
        <iframe title="$RHOZE live chart" src={RHOZE_BIRDEYE_WIDGET} className="w-full h-[340px] block" loading="lazy" />
      </div>

      {trades.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground mb-2">Latest transactions</div>
          <ul className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            {trades.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-muted/30">
                <span className={`font-medium uppercase tracking-wider ${t.kind === "buy" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{t.kind}</span>
                <span className="tabular-nums">{fmtUsd(t.usd)}</span>
                <span className="text-muted-foreground tabular-nums hidden sm:inline">{new Date(t.at).toLocaleString()}</span>
                <a href={`https://solscan.io/tx/${t.tx}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-foreground shrink-0">
                  View <ArrowUpRight className="w-3 h-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-border flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
        <Wallet className="w-3 h-3" /> Wallet lookup
      </div>
      <form onSubmit={onSubmit} className="mt-2 flex flex-col sm:flex-row gap-2">
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
            <a href={RHOZE_BIRDEYE_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              Birdeye <ExternalLink className="w-3 h-3" />
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

          {/* Wallet stat grid */}
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

          {/* Wallet activity */}
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
            Data via {data.source === "helius" ? "Helius" : "public Solana RPC"} + Birdeye. Read-only — pasting an address never grants us access.
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