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

// ---- Helius Enhanced Transactions (fast, parsed) ----
function heliusKey() { return Deno.env.get('HELIUS_API_KEY') ?? ''; }

function parseEnhanced(tx: any, sol: number) {
  const payer = tx?.feePayer;
  if (!payer || !tx?.signature) return null;
  let delta = 0;
  for (const t of tx.tokenTransfers ?? []) {
    if (t.mint !== MINT) continue;
    const amt = Number(t.tokenAmount ?? 0) || 0;
    if (t.toUserAccount === payer) delta += amt;
    if (t.fromUserAccount === payer) delta -= amt;
  }
  if (!delta) return null;
  let lam = 0;
  for (const a of tx.accountData ?? []) {
    if (a.account === payer) lam = Number(a.nativeBalanceChange ?? 0) || 0;
  }
  const solAmt = Math.abs((lam + (tx.fee ?? 0)) / 1e9);
  if (solAmt < 0.000001) return null;
  const tokens = Math.abs(delta);
  const valueUsd = solAmt * sol;
  return {
    sig: tx.signature,
    ts: new Date((tx.timestamp || 0) * 1000).toISOString(),
    side: delta > 0 ? 'buy' : 'sell',
    tokens,
    sol: solAmt,
    price_usd: tokens ? valueUsd / tokens : 0,
    value_usd: valueUsd,
    trader: payer,
  };
}

async function heliusSync(mode: 'top' | 'backfill' | 'deep') {
  const key = heliusKey();
  if (!key) return null;
  const sol = await solPriceUsd();
  const pages = mode === 'deep' ? 20 : mode === 'backfill' ? 6 : 1;
  let inserted = 0;

  // Crawl the mint plus every live pool/pair address (pump.fun curve + AMM),
  // since pump swaps don't always list the mint account.
  const addresses = [MINT];
  if (mode !== 'top') {
    try {
      const r = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${MINT}/pools`);
      const d = await r.json();
      for (const p of d?.data ?? []) {
        const a = p?.attributes?.address;
        if (a) addresses.push(a);
      }
    } catch { /* ignore */ }
  }

  for (const address of [...new Set(addresses)]) {
  let before = '';
  for (let p = 0; p < pages; p++) {
    const u = new URL(`https://api.helius.xyz/v0/addresses/${address}/transactions`);
    u.searchParams.set('api-key', key);
    u.searchParams.set('limit', '100');
    if (before) u.searchParams.set('before', before);
    const r = await fetch(u.toString());
    if (!r.ok) { console.error('helius', address, r.status, await r.text()); break; }
    const txs = await r.json();
    if (!Array.isArray(txs) || !txs.length) break;
    before = txs[txs.length - 1]?.signature ?? '';
    const rows = txs.map((t: any) => parseEnhanced(t, sol)).filter(Boolean);
    if (rows.length) {
      const { error } = await db.from('rhoze_onchain_trades').upsert(rows, { onConflict: 'sig' });
      if (error) console.error('upsert', error.message);
      else inserted += rows.length;
    }
    if (!before) break;
    await sleep(60);
  }
  }
  const { count } = await db.from('rhoze_onchain_trades').select('sig', { count: 'exact', head: true });
  return { inserted, total: count ?? 0, source: 'helius' };
}

// Pull signatures newer than what we have (or page backwards when backfilling).
async function sync(mode: 'top' | 'backfill' | 'deep') {
  const viaHelius = await heliusSync(mode);
  if (viaHelius) return viaHelius;
  if (mode === 'deep') mode = 'backfill';
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
    const price = Number(t.priceUsd ?? t.price_usd);
    if (!price || !isFinite(price)) continue;
    const b = Math.floor(t.ts / bucketSec) * bucketSec;
    const cur = map.get(b);
    const v = Number(t.valueUsd ?? t.value_usd) || 0;
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
    const rawMode = url.searchParams.get('mode');
    const mode: 'top' | 'backfill' | 'deep' =
      rawMode === 'deep' ? 'deep' : rawMode === 'backfill' ? 'backfill' : 'top';
    const wait = url.searchParams.get('wait') === '1';

    // Never block the response on RPC work — sync in the background.
    let synced: any = null;
    if (mode !== 'top' || Date.now() - lastSync > 60_000) {
      lastSync = Date.now();
      synced = { queued: mode };
      if (wait) {
        synced = await sync(mode).catch((e) => ({ error: String(e) }));
      } else {
        const job = sync(mode).catch((e) => console.error('sync failed', e));
        // @ts-ignore EdgeRuntime is available in Supabase edge functions
        if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(job);
      }
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
