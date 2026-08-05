// /invest — Market + on-chain explorer for $RHOZE.
// Live market stats, chart, and a searchable/scrollable explorer:
// Trades · Top traders · Wallet check (SOL + $RHOZE holdings via edge function).
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import type { Session } from "@supabase/supabase-js";
import { ArrowUpRight, ExternalLink, Loader2, Save, Search, X } from "lucide-react";

const RHOZE_MINT = "7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump";
const RHOZE_BIRDEYE_URL = `https://birdeye.so/token/${RHOZE_MINT}?chain=solana`;
const RHOZE_BIRDEYE_WIDGET = `https://birdeye.so/tv-widget/${RHOZE_MINT}?chain=solana&viewMode=pair&chartInterval=15&chartType=CANDLE&theme=dark`;
const RHOZE_POOL = "AjCpwQxLsW3SbueGUD2sKpGbbtUPNt64JPcSBJ2uuUiJ";
const GT_POOL = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${RHOZE_POOL}`;

type Market = { price: number; change24h: number | null; fdv: number | null; liq: number | null; vol24h: number | null };
type Trade = { id: string; kind: string; usd: number; tokens: number; price: number; at: string; tx: string; trader: string };

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

const short = (a: string) => (a && a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a || "—");
const fmtUsd = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString()}` : `$${n.toFixed(n >= 1 ? 2 : 6)}`;
const fmtNum = (n: number, d = 2) => n.toLocaleString(undefined, { maximumFractionDigits: d });
const compact = (n: number) => Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
const ago = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

type Tab = "trades" | "traders" | "wallet";

export default function WalletPanel({ session }: { session: Session | null }) {
  const [market, setMarket] = useState<Market | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [tab, setTab] = useState<Tab>("trades");
  const [q, setQ] = useState("");
  const [side, setSide] = useState<"all" | "buy" | "sell">("all");

  // wallet check
  const [addr, setAddr] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Lookup | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
        const r = await fetch(`${GT_POOL}/trades?trade_volume_in_usd_greater_than=0`, { cache: "no-store" });
        const j = await r.json();
        const rows: Trade[] = (j?.data ?? []).map((t: any) => {
          const a = t.attributes ?? {};
          const kind = a.kind ?? "trade";
          return {
            id: t.id,
            kind,
            usd: Number(a.volume_in_usd ?? 0),
            tokens: Number(kind === "buy" ? a.to_token_amount ?? 0 : a.from_token_amount ?? 0),
            price: Number(a.price_to_in_usd ?? a.price_from_in_usd ?? 0),
            at: a.block_timestamp,
            tx: a.tx_hash,
            trader: a.tx_from_address ?? "",
          };
        });
        if (alive) setTrades(rows);
      } catch { /* ignore */ }
      if (alive) setLoadingTrades(false);
    };
    load();
    const id = setInterval(load, 60000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (!session) { setSaved(null); return; }
    (async () => {
      const { data } = await supabase.from("profiles").select("solana_wallet").eq("id", session.user.id).maybeSingle();
      const w = (data as any)?.solana_wallet as string | null;
      if (w) { setSaved(w); setAddr(w); }
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
    const { error } = await supabase.from("profiles").update({ solana_wallet: data.address }).eq("id", session.user.id);
    if (error) { toast({ title: "Couldn't save", description: error.message, variant: "destructive" }); return; }
    setSaved(data.address);
    toast({ title: "Wallet saved to your profile" });
  };
  const clearFromProfile = async () => {
    if (!session) return;
    const { error } = await supabase.from("profiles").update({ solana_wallet: null }).eq("id", session.user.id);
    if (error) { toast({ title: "Couldn't clear", description: error.message, variant: "destructive" }); return; }
    setSaved(null);
    toast({ title: "Removed from profile" });
  };

  const filteredTrades = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return trades.filter((t) => {
      if (side !== "all" && t.kind !== side) return false;
      if (!needle) return true;
      return t.trader.toLowerCase().includes(needle) || t.tx.toLowerCase().includes(needle);
    });
  }, [trades, q, side]);

  const topTraders = useMemo(() => {
    const map = new Map<string, { addr: string; buys: number; sells: number; usd: number; net: number }>();
    for (const t of trades) {
      if (!t.trader) continue;
      const row = map.get(t.trader) ?? { addr: t.trader, buys: 0, sells: 0, usd: 0, net: 0 };
      row.usd += t.usd;
      if (t.kind === "buy") { row.buys++; row.net += t.usd; } else { row.sells++; row.net -= t.usd; }
      map.set(t.trader, row);
    }
    const needle = q.trim().toLowerCase();
    return [...map.values()]
      .filter((r) => !needle || r.addr.toLowerCase().includes(needle))
      .sort((a, b) => b.usd - a.usd)
      .slice(0, 50);
  }, [trades, q]);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
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

      {/* ── On-chain explorer ─────────────────────────────────────────── */}
      <div className="mt-6 pt-5 border-t border-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
            {([["trades", "Trades"], ["traders", "Top traders"], ["wallet", "Wallet check"]] as [Tab, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-3 py-1.5 rounded-md transition-colors ${tab === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
          {tab !== "wallet" && (
            <div className="flex items-center gap-2">
              {tab === "trades" && (
                <div className="inline-flex rounded-lg border border-border p-0.5 text-[11px]">
                  {(["all", "buy", "sell"] as const).map((s) => (
                    <button key={s} onClick={() => setSide(s)}
                      className={`px-2.5 py-1 rounded-md uppercase tracking-wider ${side === s ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search wallet or tx"
                  className="h-8 pl-8 w-[190px] font-mono text-xs" spellCheck={false} />
              </div>
            </div>
          )}
        </div>

        {tab === "trades" && (
          <div className="mt-3 rounded-xl border border-border overflow-hidden">
            <div className="grid grid-cols-[64px_1fr_1fr_1fr_60px] gap-2 px-3 py-2 bg-muted/40 text-[10px] tracking-[0.16em] uppercase text-muted-foreground">
              <span>Type</span><span className="text-right">Value</span><span className="text-right hidden sm:block">$RHOZE</span><span className="text-right">Trader</span><span className="text-right">Age</span>
            </div>
            <div className="max-h-[380px] overflow-y-auto divide-y divide-border">
              {loadingTrades && <div className="px-3 py-6 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading on-chain trades…</div>}
              {!loadingTrades && filteredTrades.length === 0 && <div className="px-3 py-6 text-xs text-muted-foreground">No trades match that search.</div>}
              {filteredTrades.map((t) => (
                <a key={t.id} href={`https://solscan.io/tx/${t.tx}`} target="_blank" rel="noopener"
                  className="grid grid-cols-[64px_1fr_1fr_1fr_60px] gap-2 px-3 py-2 text-xs hover:bg-muted/30 items-center">
                  <span className={`font-medium uppercase tracking-wider ${t.kind === "buy" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{t.kind}</span>
                  <span className="tabular-nums text-right">{fmtUsd(t.usd)}</span>
                  <span className="tabular-nums text-right text-muted-foreground hidden sm:block">{compact(t.tokens)}</span>
                  <span className="font-mono text-right text-muted-foreground truncate">{short(t.trader)}</span>
                  <span className="tabular-nums text-right text-muted-foreground">{t.at ? ago(t.at) : "—"}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {tab === "traders" && (
          <div className="mt-3 rounded-xl border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_90px_90px_80px] gap-2 px-3 py-2 bg-muted/40 text-[10px] tracking-[0.16em] uppercase text-muted-foreground">
              <span>Wallet</span><span className="text-right">Volume</span><span className="text-right">Net flow</span><span className="text-right">Trades</span>
            </div>
            <div className="max-h-[380px] overflow-y-auto divide-y divide-border">
              {topTraders.length === 0 && <div className="px-3 py-6 text-xs text-muted-foreground">No traders yet.</div>}
              {topTraders.map((r) => (
                <a key={r.addr} href={`https://solscan.io/account/${r.addr}`} target="_blank" rel="noopener"
                  className="grid grid-cols-[1fr_90px_90px_80px] gap-2 px-3 py-2 text-xs hover:bg-muted/30 items-center">
                  <span className="font-mono truncate">{short(r.addr)}</span>
                  <span className="tabular-nums text-right">{fmtUsd(r.usd)}</span>
                  <span className={`tabular-nums text-right ${r.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {r.net >= 0 ? "+" : "−"}{fmtUsd(Math.abs(r.net))}
                  </span>
                  <span className="tabular-nums text-right text-muted-foreground">{r.buys}B / {r.sells}S</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {tab === "wallet" && (
          <div className="mt-3">
            <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2">
              <Input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Paste any Solana address"
                className="font-mono text-sm" spellCheck={false} autoCorrect="off" autoCapitalize="off" />
              <Button type="submit" disabled={busy || !addr.trim()}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="ml-1.5">Look up</span>
              </Button>
            </form>
            {err && <div className="mt-2 text-xs text-red-600 dark:text-red-400">{err}</div>}
            {data && (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <code className="px-2 py-1 rounded-md bg-muted font-mono">{short(data.address)}</code>
                  <a href={data.solscan} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-foreground underline underline-offset-4">Solscan <ExternalLink className="w-3 h-3" /></a>
                  {session && (saved === data.address ? (
                    <button onClick={clearFromProfile} className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /> Saved — remove</button>
                  ) : (
                    <button onClick={saveToProfile} className="ml-auto inline-flex items-center gap-1 text-foreground underline underline-offset-4"><Save className="w-3 h-3" /> Save to my profile</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Stat label="$RHOZE balance" value={fmtNum(data.rhoze.balance, 0)} sub={fmtUsd(data.rhoze.valueUsd)} />
                  <Stat label="SOL balance" value={`${fmtNum(data.sol.balance, 3)} SOL`} />
                  <Stat label="$RHOZE price" value={fmtUsd(data.market.priceUsd)} />
                </div>
                {data.recent.length > 0 && (
                  <ul className="rounded-xl border border-border overflow-hidden divide-y divide-border max-h-[240px] overflow-y-auto">
                    {data.recent.map((t) => (
                      <li key={t.signature} className="flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/30">
                        <div className="min-w-0 flex items-center gap-2">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${t.err ? "bg-red-500" : "bg-emerald-500"}`} />
                          <code className="font-mono truncate">{short(t.signature)}</code>
                          <span className="text-muted-foreground shrink-0">{t.blockTime ? new Date(t.blockTime * 1000).toLocaleDateString() : "—"}</span>
                        </div>
                        <a href={t.solscan} target="_blank" rel="noopener" className="text-foreground inline-flex items-center gap-1 shrink-0">View <ArrowUpRight className="w-3 h-3" /></a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-3 text-[10px] text-muted-foreground">
          Live on-chain data via GeckoTerminal + public Solana RPC. Read-only — pasting an address never grants us access.
        </div>
      </div>
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
