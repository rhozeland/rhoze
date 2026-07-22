// Replaces the user's custodial wallet with a pubkey they provide.
// Wipes the encrypted secret and marks is_custodial=false. Non-reversible from client.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PublicKey } from "npm:@solana/web3.js@1.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await anon.auth.getUser();
    const user = u.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const { pubkey } = await req.json() as { pubkey?: string };
    if (!pubkey || typeof pubkey !== "string") return json({ error: "pubkey required" }, 400);
    // Validate base58 Solana address
    try { new PublicKey(pubkey); } catch { return json({ error: "invalid Solana address" }, 400); }

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.from("user_wallets").upsert({
      user_id: user.id,
      pubkey,
      secret_encrypted: null,
      is_custodial: false,
    });
    if (error) throw error;
    await admin.from("profiles").update({ solana_wallet: pubkey }).eq("id", user.id);

    return json({ pubkey, is_custodial: false });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}