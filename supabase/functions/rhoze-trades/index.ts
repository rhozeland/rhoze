// Public $RHOZE on-chain trade feed + candles.
// Reads cached swaps from public.rhoze_onchain_trades and incrementally tops it
// up from Solana RPC (throttled, since we run on the free public endpoint).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const MINT = '7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function rpcUrl() {
  const key = Deno.env.get('HELIUS_API_KEY');
  return key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : 'https://api.mainnet-beta.solana.com';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rpcBatch(calls: { method: string; params: unknown[] }[], tries = 4): Promise<any[]> {
  const body = calls.map((c, i) => ({ jsonrpc: '2.0', id: i, method: c.method, params: c.params }));
  for (let attempt = 0; attempt < tries; attempt++) {
    const r = await fetch(rpcUrl(), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (r.status === 429) { await sleep(600 * (attempt + 1)); continue; }
    if (!r.ok) { await sleep(400); continue; }
    const j = await r.json();
    const arr = Array.isArray(j) ? j : [j];
    if (arr.some((x) => x?.error?.code === 429)) { await sleep(600 * (attempt + 1)); continue; }
    const out: any[] = new Array(calls.length).fill(null);
    for (const item of arr) out[item.id] = item.result ?? null;
    return out;
  }
  return new Array(calls.length).fill(null);
}

async function solPriceUsd(): Promise<number> {
  try {
    const r = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112');
    const d = await r.json();
    const pairs = (d?.pairs ?? []).filter((p: any) => p?.priceUsd);
    pairs.sort((a: any, b: any) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0));
    const p = parseFloat(pairs[0]?.priceUsd ?? '0');
    return isFinite(p) && p > 0 ? p : 0;
  } catch { return 0; }
}

function parseTx(sig: string, blockTime: number, t: any, sol: number) {
  if (!t?.meta) return null;
  const meta = t.meta;
  const keys = (t.transaction?.message?.accountKeys ?? []).map((a: any) => a.pubkey ?? a);
  const payer = keys[0];
  if (!payer) return null;
  const bal = (arr: any[]) => {
    for (const b of arr ?? []) {
      if (b.mint === MINT && b.owner === payer) return Number(b.uiTokenAmount?.uiAmount ?? 0) || 0;
    }
    return 0;
  };
  const delta = bal(meta.postTokenBalances) - bal(meta.preTokenBalances);
  if (!delta) return null;
  const lam = (meta.postBalances?.[0] ?? 0) - (meta.preBalances?.[0] ?? 0) + (meta.fee ?? 0);
  const solAmt = Math.abs(lam / 1e9);
  if (solAmt < 0.000001) return null;
  const tokens = Math.abs(delta);
  const valueUsd = solAmt * sol;
  return {
    sig,
    ts: new Date((blockTime || 0) * 1000).toISOString(),
    side: delta > 0 ? 'buy' : 'sell',
    tokens,
    sol: solAmt,
    price_usd: tokens ? valueUsd / tokens : 0,
    value_usd: valueUsd,
    trader: payer,
  };
}

// Pull signatures newer than what we have (or page backwards when backfilling).
async function sync(mode: 'top' | 'backfill') {
  const sol = await solPriceUsd();
  let before: string | undefined;
  if (mode === 'backfill') {
    const { data } = await db.from('rhoze_onchain_trades').select('sig,ts').order('ts', { ascending: true }).limit(1);
    before = data?.[0]?.sig;
  }
  const { count } = await db.from('rhoze_onchain_trades').select('sig', { count: 'exact', head: true });
  const known = new Set<string>();
  if (mode === 'top') {
    const { data } = await db.from('rhoze_onchain_trades').select('sig').order('ts', { ascending: false }).limit(400);
    (data ?? []).forEach((r: any) => known.add(r.sig));
  }
  const pages = mode === 'backfill' ? 2 : 1;
  const rows: any[] = [];
  for (let p = 0; p < pages; p++) {
    const sigs: any[] = (await rpcBatch([{
      method: 'getSignaturesForAddress',
      params: [MINT, { limit: 150, ...(before ? { before } : {}) }],
    }]))[0] ?? [];
    if (!sigs.length) break;
    before = sigs[sigs.length - 1].signature;
    const todo = sigs.filter((s) => !s.err && !known.has(s.signature));
    for (let i = 0; i < todo.length; i += 10) {
      const chunk = todo.slice(i, i + 10);
      const txs = await rpcBatch(chunk.map((s) => ({
        method: 'getTransaction',
        params: [s.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
      })));
      txs.forEach((t, k) => {
        const row = parseTx(chunk[k].signature, chunk[k].blockTime, t, sol);
        if (row) rows.push(row);
      });
      await sleep(120);
    }
  }
  if (rows.length) await db.from('rhoze_onchain_trades').upsert(rows, { onConflict: 'sig' });
  return { inserted: rows.length, total: count ?? 0 };
}

function candles(trades: any[], bucketSec: number, max: number) {
  const map = new Map<number, { o: number; h: number; l: number; c: number; v: number }>();
  const asc = [...trades].sort((a, b) => a.ts - b.ts);
  for (const t of asc) {
    const price = Number(t.price_usd);
    if (!price || !isFinite(price)) continue;
    const b = Math.floor(t.ts / bucketSec) * bucketSec;
    const cur = map.get(b);
    const v = Number(t.value_usd) || 0;
    if (!cur) map.set(b, { o: price, h: price, l: price, c: price, v });
    else {
      cur.h = Math.max(cur.h, price);
      cur.l = Math.min(cur.l, price);
      cur.c = price;
      cur.v += v;
    }
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0])
    .map(([ts, k]) => [ts, k.o, k.h, k.l, k.c, k.v]).slice(-max);
}

let lastSync = 0;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const bucket = Math.max(300, parseInt(url.searchParams.get('bucket') ?? '3600') || 3600);
    const limit = Math.min(500, Math.max(10, parseInt(url.searchParams.get('limit') ?? '200') || 200));
    const mode = url.searchParams.get('mode') === 'backfill' ? 'backfill' : 'top';

    // Never block the response on RPC work — sync in the background.
    let synced: any = null;
    if (mode === 'backfill' || Date.now() - lastSync > 60_000) {
      lastSync = Date.now();
      synced = { queued: mode };
      const job = sync(mode).catch((e) => console.error('sync failed', e));
      // @ts-ignore EdgeRuntime is available in Supabase edge functions
      if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(job);
    }

    const { data } = await db.from('rhoze_onchain_trades')
      .select('sig,ts,side,tokens,sol,price_usd,value_usd,trader')
      .order('ts', { ascending: false }).limit(limit);

    const trades = (data ?? []).map((r: any) => ({
      sig: r.sig,
      ts: Math.floor(new Date(r.ts).getTime() / 1000),
      type: r.side,
      tokens: Number(r.tokens),
      sol: Number(r.sol),
      priceUsd: Number(r.price_usd),
      valueUsd: Number(r.value_usd),
      trader: r.trader,
    }));

    return new Response(JSON.stringify({
      trades,
      candles: candles(trades, bucket, 150),
      synced,
      updatedAt: Date.now(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('rhoze-trades failed:', e);
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
