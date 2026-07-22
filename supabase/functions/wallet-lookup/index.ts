// Public wallet-lookup endpoint. Given a Solana wallet address, returns:
//   - SOL balance
//   - $RHOZE token balance
//   - DexScreener price + 24h change + market cap
//   - USD-valued holdings
//   - Recent $RHOZE transfer signatures (with Solscan deep links)
// Uses Helius RPC when HELIUS_API_KEY is present, otherwise falls back to the
// public Solana mainnet-beta RPC. DexScreener is free/no-key.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const RHOZE_MINT = '7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump';
const RHOZE_PAIR = 'C4rRvr1GCNEeYHwA6MaSbgyckY7671Rq3X4yfeGm4rmF';

function rpcUrl() {
  const key = Deno.env.get('HELIUS_API_KEY');
  return key
    ? `https://mainnet.helius-rpc.com/?api-key=${key}`
    : 'https://api.mainnet-beta.solana.com';
}

async function rpc<T = any>(method: string, params: unknown[]): Promise<T> {
  const r = await fetch(rpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message ?? 'RPC error');
  return j.result as T;
}

function isBase58Address(s: string) {
  return typeof s === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const address = (body.address ?? url.searchParams.get('address') ?? '').toString().trim();
    if (!isBase58Address(address)) {
      return new Response(JSON.stringify({ error: 'Invalid Solana address' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DexScreener market data (no key)
    const dexP = fetch(`https://api.dexscreener.com/latest/dex/tokens/${RHOZE_MINT}`)
      .then((r) => r.json())
      .catch(() => null);

    const [solLamports, tokenAccts, signatures] = await Promise.all([
      rpc<{ value: number }>('getBalance', [address]),
      rpc<{ value: any[] }>('getTokenAccountsByOwner', [
        address, { mint: RHOZE_MINT }, { encoding: 'jsonParsed' },
      ]),
      rpc<any[]>('getSignaturesForAddress', [address, { limit: 10 }]),
    ]);

    let rhozeUi = 0;
    for (const a of tokenAccts?.value ?? []) {
      const amt = a?.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
      if (typeof amt === 'number') rhozeUi += amt;
    }

    const dex = await dexP;
    const pairs: any[] = dex?.pairs ?? [];
    const pair = pairs.find((p) => p?.pairAddress?.toLowerCase() === RHOZE_PAIR.toLowerCase()) ?? pairs[0];
    const priceUsd = pair?.priceUsd ? Number(pair.priceUsd) : 0;
    const change24h = pair?.priceChange?.h24 ?? null;
    const liquidityUsd = pair?.liquidity?.usd ?? null;
    const fdvUsd = pair?.fdv ?? null;
    const volume24h = pair?.volume?.h24 ?? null;

    const rhozeUsd = rhozeUi * priceUsd;
    const solUi = (solLamports?.value ?? 0) / 1e9;

    const txs = (signatures ?? []).map((s: any) => ({
      signature: s.signature,
      slot: s.slot,
      blockTime: s.blockTime,
      err: s.err,
      solscan: `https://solscan.io/tx/${s.signature}`,
    }));

    return new Response(JSON.stringify({
      address,
      solscan: `https://solscan.io/account/${address}`,
      sol: { balance: solUi },
      rhoze: {
        mint: RHOZE_MINT,
        balance: rhozeUi,
        priceUsd,
        valueUsd: rhozeUsd,
        change24h,
      },
      market: {
        priceUsd,
        change24h,
        liquidityUsd,
        fdvUsd,
        volume24h,
        pairUrl: pair?.url ?? `https://dexscreener.com/solana/${RHOZE_PAIR.toLowerCase()}`,
      },
      recent: txs,
      source: Deno.env.get('HELIUS_API_KEY') ? 'helius' : 'public-rpc',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});