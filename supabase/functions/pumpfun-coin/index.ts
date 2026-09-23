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
        if (c?.symbol) return json({ mint: m, ticker: c.symbol, name: c.name ?? c.symbol, image: c.image_uri ?? null, source: "pump.fun" });
      }
    } catch { /* fallback */ }

    // 2) DexScreener
    try {
      const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${m}`);
      if (r.ok) {
        const d = await r.json();
        const p = (d?.pairs ?? []).find((x: any) => x?.baseToken?.address === m) ?? d?.pairs?.[0];
        if (p?.baseToken?.symbol) return json({ mint: m, ticker: p.baseToken.symbol, name: p.baseToken.name, image: p.info?.imageUrl ?? null, source: "dexscreener" });
      }
    } catch { /* ignore */ }

    return json({ error: "Coin not found on Pump.fun." }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "Lookup failed." }, 500);
  }
});
