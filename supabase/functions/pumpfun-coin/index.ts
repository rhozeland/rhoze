import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

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
        if (c?.symbol) return json({ mint: m, ticker: c.symbol, name: c.name ?? c.symbol, image: c.image_uri ?? null, mcap: typeof c.usd_market_cap === "number" ? c.usd_market_cap : null, source: "pump.fun" });
      }
    } catch { /* fallback */ }

    // 2) DexScreener
    try {
      const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${m}`);
      if (r.ok) {
        const d = await r.json();
        const p = (d?.pairs ?? []).find((x: any) => x?.baseToken?.address === m) ?? d?.pairs?.[0];
        if (p?.baseToken?.symbol) return json({ mint: m, ticker: p.baseToken.symbol, name: p.baseToken.name, image: p.info?.imageUrl ?? null, mcap: typeof p.marketCap === "number" ? p.marketCap : (typeof p.fdv === "number" ? p.fdv : null), source: "dexscreener" });
      }
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

    return json({ error: "Coin not found on Pump.fun." }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "Lookup failed." }, 500);
  }
});
