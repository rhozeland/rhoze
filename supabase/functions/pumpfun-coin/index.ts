import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { PublicKey } from "npm:@solana/web3.js@1";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const finiteNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

async function dexMarket(mint: string) {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const data = await response.json();
    return (data?.pairs ?? [])
      .filter((pair: any) => pair?.chainId === "solana" && pair?.baseToken?.address === mint)
      .sort((a: any, b: any) => Number(b?.liquidity?.usd || 0) - Number(a?.liquidity?.usd || 0))[0] ?? null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { mint } = await req.json().catch(() => ({}));
    if (typeof mint !== "string" || !MINT_RE.test(mint.trim())) return json({ error: "That doesn't look like a Solana mint address." }, 400);
    const m = mint.trim();

    // 1) pump.fun
    try {
      const r = await fetch(`https://frontend-api-v3.pump.fun/coins/${m}`, { headers: { accept: "application/json" } });
      if (r.ok) {
        const c = await r.json();
        if (c?.symbol) {
          const pair = await dexMarket(m);
          const supply = finiteNumber(c.total_supply);
          const cap = finiteNumber(c.usd_market_cap);
          const derivedPrice = cap !== null && supply !== null && supply > 0 ? cap / (supply / 1e6) : null;
          return json({ mint: m, ticker: c.symbol, name: c.name ?? c.symbol, image: c.image_uri ?? null, mcap: cap, priceUsd: finiteNumber(pair?.priceUsd) ?? derivedPrice, change24h: finiteNumber(pair?.priceChange?.h24), source: "pump.fun" });
        }
      }
    } catch { /* fallback */ }

    // 2) DexScreener
    try {
      const p = await dexMarket(m);
      if (p?.baseToken?.symbol) return json({ mint: m, ticker: p.baseToken.symbol, name: p.baseToken.name, image: p.info?.imageUrl ?? null, mcap: typeof p.marketCap === "number" ? p.marketCap : (typeof p.fdv === "number" ? p.fdv : null), priceUsd: finiteNumber(p.priceUsd), change24h: finiteNumber(p.priceChange?.h24), source: "dexscreener" });
    } catch { /* ignore */ }

    // 3) Jupiter quote (works for graduated pump.fun coins): price of 1 token in USDC,
    //    then market cap = price × on-chain total supply.
    try {
      const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const q = await fetch(`https://lite-api.jup.ag/swap/v1/quote?inputMint=${m}&outputMint=${USDC}&amount=1000000`);
      if (q.ok) {
        const quote = await q.json();
        const out = Number(quote?.outAmount);
        if (out > 0) {
          const price = out / 1e6; // USDC has 6 decimals; 1 token quoted
          let supply = 1_000_000_000; // pump.fun standard
          try {
            const key = Deno.env.get("HELIUS_API_KEY");
            const rpc = await fetch(key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : "https://api.mainnet-beta.solana.com", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenSupply", params: [m] }),
            });
            const sj = await rpc.json();
            const ui = sj?.result?.value?.uiAmount;
            if (typeof ui === "number" && ui > 0) supply = ui;
          } catch { /* keep default supply */ }
          return json({ mint: m, mcap: price * supply, priceUsd: price, source: "jupiter" });
        }
      }
    } catch { /* ignore */ }

    // 4) On-chain fallback for brand-new pump.fun coins not yet indexed anywhere:
    //    read the bonding curve account, price = virtualSol/virtualToken, mcap = price × supply × SOL price.
    try {
      const key = Deno.env.get("HELIUS_API_KEY");
      const rpcUrl = key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : "https://api.mainnet-beta.solana.com";
      const rpcCall = async (method: string, params: unknown[]) => {
        const r = await fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
        return (await r.json())?.result;
      };
      const PUMP_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
      const mintPk = new PublicKey(m);
      const [curve] = PublicKey.findProgramAddressSync([new TextEncoder().encode("bonding-curve"), mintPk.toBuffer()], PUMP_PROGRAM);
      const acct = await rpcCall("getAccountInfo", [curve.toBase58(), { encoding: "base64" }]);
      const b64 = acct?.value?.data?.[0];
      if (b64) {
        const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const dv = new DataView(buf.buffer);
        const u64 = (off: number) => Number(dv.getBigUint64(off, true));
        const vToken = u64(8), vSol = u64(16), supplyRaw = u64(40);
        if (vToken > 0 && vSol > 0) {
          const priceSol = vSol / vToken / 1000; // lamports per raw token → SOL per whole token (×1e6 raw/token, ÷1e9 lamports/SOL)
          const supply = supplyRaw > 0 ? supplyRaw / 1e6 : 1_000_000_000;
          // SOL price in USD via Jupiter quote (1 SOL → USDC)
          let solUsd = 0;
          const q = await fetch("https://lite-api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000");
          if (q.ok) { const qj = await q.json(); solUsd = Number(qj?.outAmount) / 1e6; }
          if (solUsd > 0) return json({ mint: m, mcap: priceSol * supply * solUsd, priceUsd: priceSol * solUsd, source: "onchain" });
        }
      }
    } catch { /* ignore */ }

    return json({ error: "Coin not found on Pump.fun." }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "Lookup failed." }, 500);
  }
});
