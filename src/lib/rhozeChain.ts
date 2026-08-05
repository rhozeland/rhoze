// Direct-from-chain $RHOZE trade reader.
// The browser talks to the public Solana RPC (allowed from user IPs), parses
// swaps out of each transaction, and caches the result in localStorage so the
// panel and the homepage chart stay snappy.

export const RHOZE_MINT = "7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump";
const RPC = "https://api.mainnet-beta.solana.com";
const CACHE_KEY = "rhoze_trades_cache_v1";
const CACHE_TTL = 5 * 60 * 1000;

export type ChainTrade = {
  sig: string;
  ts: number;
  type: "buy" | "sell";
  tokens: number;
  sol: number;
  priceUsd: number;
  valueUsd: number;
  trader: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rpcBatch(calls: { method: string; params: unknown[] }[], tries = 3): Promise<any[]> {
  const body = calls.map((c, i) => ({ jsonrpc: "2.0", id: i, method: c.method, params: c.params }));
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const r = await fetch(RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 429) { await sleep(700 * (attempt + 1)); continue; }
      const j = await r.json();
      const arr = Array.isArray(j) ? j : [j];
      if (arr.some((x: any) => x?.error?.code === 429)) { await sleep(700 * (attempt + 1)); continue; }
      const out: any[] = new Array(calls.length).fill(null);
      for (const item of arr) out[item.id] = item.result ?? null;
      return out;
    } catch {
      await sleep(400);
    }
  }
  return new Array(calls.length).fill(null);
}

export async function fetchSolPriceUsd(): Promise<number> {
  try {
    const r = await fetch(
      "https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112",
    );
    const d = await r.json();
    const pairs = (d?.pairs ?? []).filter((p: any) => p?.priceUsd);
    pairs.sort((a: any, b: any) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0));
    const p = parseFloat(pairs[0]?.priceUsd ?? "0");
    return isFinite(p) && p > 0 ? p : 0;
  } catch {
    return 0;
  }
}

function parseTx(sig: string, blockTime: number, t: any, solPrice: number): ChainTrade | null {
  const meta = t?.meta;
  if (!meta) return null;
  const keys = (t.transaction?.message?.accountKeys ?? []).map((a: any) => a.pubkey ?? a);
  const payer = keys[0];
  if (!payer) return null;
  const bal = (arr: any[]) => {
    for (const b of arr ?? []) {
      if (b.mint === RHOZE_MINT && b.owner === payer) return Number(b.uiTokenAmount?.uiAmount ?? 0) || 0;
    }
    return 0;
  };
  const delta = bal(meta.postTokenBalances) - bal(meta.preTokenBalances);
  if (!delta) return null;
  const lam = (meta.postBalances?.[0] ?? 0) - (meta.preBalances?.[0] ?? 0) + (meta.fee ?? 0);
  const sol = Math.abs(lam / 1e9);
  if (sol < 0.000001) return null;
  const tokens = Math.abs(delta);
  const valueUsd = sol * solPrice;
  return {
    sig,
    ts: blockTime || 0,
    type: delta > 0 ? "buy" : "sell",
    tokens,
    sol,
    priceUsd: tokens ? valueUsd / tokens : 0,
    valueUsd,
    trader: payer,
  };
}

function readCache(): ChainTrade[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p?.at || Date.now() - p.at > CACHE_TTL) return null;
    return p.trades as ChainTrade[];
  } catch {
    return null;
  }
}

export async function fetchRhozeTrades(opts: {
  maxTrades?: number;
  maxSignatures?: number;
  force?: boolean;
  onPartial?: (trades: ChainTrade[]) => void;
} = {}): Promise<ChainTrade[]> {
  const { maxTrades = 120, maxSignatures = 400, force = false, onPartial } = opts;
  if (!force) {
    const cached = readCache();
    if (cached?.length) return cached;
  }

  const solPrice = await fetchSolPriceUsd();
  const trades: ChainTrade[] = [];
  let before: string | undefined;

  for (let page = 0; page * 200 < maxSignatures && trades.length < maxTrades; page++) {
    const sigs: any[] =
      (await rpcBatch([
        { method: "getSignaturesForAddress", params: [RHOZE_MINT, { limit: 200, ...(before ? { before } : {}) }] },
      ]))[0] ?? [];
    if (!sigs.length) break;
    before = sigs[sigs.length - 1].signature;
    const ok = sigs.filter((s) => !s.err);
    for (let i = 0; i < ok.length && trades.length < maxTrades; i += 10) {
      const chunk = ok.slice(i, i + 10);
      const txs = await rpcBatch(
        chunk.map((s) => ({
          method: "getTransaction",
          params: [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
        })),
      );
      txs.forEach((t, k) => {
        const row = parseTx(chunk[k].signature, chunk[k].blockTime, t, solPrice);
        if (row) trades.push(row);
      });
      onPartial?.([...trades].sort((a, b) => b.ts - a.ts));
      await sleep(140);
    }
  }

  trades.sort((a, b) => b.ts - a.ts);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), trades }));
  } catch { /* quota */ }
  return trades;
}

export type Candle = { ts: number; o: number; h: number; l: number; c: number; v: number };

export function buildCandles(trades: ChainTrade[], bucketSec: number, max = 90): Candle[] {
  const map = new Map<number, Candle>();
  [...trades]
    .sort((a, b) => a.ts - b.ts)
    .forEach((t) => {
      if (!t.priceUsd || !isFinite(t.priceUsd)) return;
      const b = Math.floor(t.ts / bucketSec) * bucketSec;
      const cur = map.get(b);
      if (!cur) map.set(b, { ts: b, o: t.priceUsd, h: t.priceUsd, l: t.priceUsd, c: t.priceUsd, v: t.valueUsd });
      else {
        cur.h = Math.max(cur.h, t.priceUsd);
        cur.l = Math.min(cur.l, t.priceUsd);
        cur.c = t.priceUsd;
        cur.v += t.valueUsd;
      }
    });
  return [...map.values()].sort((a, b) => a.ts - b.ts).slice(-max);
}
