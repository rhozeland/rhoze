// Links a self-custody Solana wallet only after the user proves control by
// signing a short message bound to their account id and a fresh timestamp.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import bs58 from "npm:bs58@6.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_AGE_MS = 10 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await anon.auth.getUser();
    const user = u.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const { pubkey, message, signature } = await req.json() as { pubkey?: string; message?: string; signature?: string };
    if (!pubkey || !message || !signature) return json({ error: "Sign the message in your wallet to link it." }, 400);

    let pk: Uint8Array, sig: Uint8Array;
    try { pk = bs58.decode(pubkey); sig = bs58.decode(signature); } catch { return json({ error: "Invalid wallet proof." }, 400); }
    if (pk.length !== 32 || sig.length !== 64) return json({ error: "Invalid wallet proof." }, 400);

    const lines = message.split("\n");
    const get = (k: string) => lines.find((l) => l.startsWith(k + ": "))?.slice(k.length + 2);
    if (lines[0] !== "Rhozeland wallet link" || get("Account") !== user.id || get("Wallet") !== pubkey) {
      return json({ error: "This proof was signed for a different account or wallet." }, 400);
    }
    const issued = Date.parse(get("Issued") || "");
    if (!issued || Math.abs(Date.now() - issued) > MAX_AGE_MS) return json({ error: "Proof expired — sign again." }, 400);

    const key = await crypto.subtle.importKey("raw", pk, { name: "Ed25519" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("Ed25519", key, sig, new TextEncoder().encode(message));
    if (!ok) return json({ error: "Signature doesn't match this wallet." }, 400);

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.from("user_wallets").upsert({ user_id: user.id, pubkey, secret_encrypted: null, is_custodial: false });
    if (error) throw error;
    await admin.from("profiles").update({ solana_wallet: pubkey }).eq("id", user.id);
    return json({ pubkey, is_custodial: false });
  } catch (e) {
    console.error("wallet-replace-external", e);
    return json({ error: "Couldn't link wallet. Try again." }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
