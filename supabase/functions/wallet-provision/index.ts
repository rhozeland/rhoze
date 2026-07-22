// Ensures the signed-in user has a custodial Solana wallet.
// Generates an Ed25519 keypair, encrypts the 64-byte secret with AES-GCM
// under WALLET_ENCRYPTION_KEY, and upserts the row. Returns { pubkey, is_custodial }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Keypair } from "npm:@solana/web3.js@1.95.3";
import bs58 from "npm:bs58@6.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function importKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("WALLET_ENCRYPTION_KEY");
  if (!raw) throw new Error("WALLET_ENCRYPTION_KEY missing");
  // Derive a 32-byte AES key from the secret via SHA-256.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptSecret(secret: Uint8Array): Promise<Uint8Array> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, secret));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0); out.set(ct, iv.length);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await anon.auth.getUser();
    const user = u.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: existing } = await admin
      .from("user_wallets").select("pubkey, is_custodial").eq("user_id", user.id).maybeSingle();
    if (existing) return json({ pubkey: existing.pubkey, is_custodial: existing.is_custodial });

    const kp = Keypair.generate();
    const pubkey = kp.publicKey.toBase58();
    const secret = new Uint8Array(kp.secretKey); // 64 bytes
    const encrypted = await encryptSecret(secret);

    const { error } = await admin.from("user_wallets").insert({
      user_id: user.id,
      pubkey,
      secret_encrypted: `\\x${[...encrypted].map(b => b.toString(16).padStart(2, "0")).join("")}`,
      is_custodial: true,
    });
    if (error) throw error;

    // Backfill profile display of wallet for existing UI paths.
    await admin.from("profiles").update({ solana_wallet: pubkey }).eq("id", user.id);

    return json({ pubkey, is_custodial: true });
  } catch (e) {
    console.error("wallet-provision", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}