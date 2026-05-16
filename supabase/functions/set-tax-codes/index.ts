// One-time admin call: assign appropriate tax codes (txcd_*) to each Stripe product.
// Required for full compliance handling. Re-runnable safely.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Tax code map. Looked up against https://docs.stripe.com/tax/tax-codes
// All Rhozeland services are creative/digital services delivered electronically.
// We use txcd_10103001 ("Electronically supplied services") because it is on
// Managed Payments' eligible-product allowlist; the previous "Other services"
// (txcd_20030000) is rejected by Managed Payments.
const ELECTRONIC_SERVICES = "txcd_10103001";
const TAX_CODES: Record<string, string> = {
  tier_bronze: ELECTRONIC_SERVICES,
  tier_gold: ELECTRONIC_SERVICES,
  tier_diamond: ELECTRONIC_SERVICES,
  alc_studio_rental: ELECTRONIC_SERVICES,
  alc_audio_recording: ELECTRONIC_SERVICES,
  alc_mixing: ELECTRONIC_SERVICES,
  alc_mastering: ELECTRONIC_SERVICES,
  alc_mv_edit: ELECTRONIC_SERVICES,
  alc_photo_shoot: ELECTRONIC_SERVICES,
  alc_podcast: ELECTRONIC_SERVICES,
  alc_design: ELECTRONIC_SERVICES,
  alc_consult: ELECTRONIC_SERVICES,
  project_deposit: ELECTRONIC_SERVICES,
  alc_content_edit: ELECTRONIC_SERVICES,
  alc_commercial_edit: ELECTRONIC_SERVICES,
  alc_short_form_edit: ELECTRONIC_SERVICES,
  alc_graphic_design: ELECTRONIC_SERVICES,
  alc_web_development: ELECTRONIC_SERVICES,
  alc_uiux_development: ELECTRONIC_SERVICES,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token!);
    if (!user) return jsonError("unauthorized", 401);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) return jsonError("admin only", 403);

    const { environment } = await req.json();
    if (environment !== "sandbox" && environment !== "live") return jsonError("invalid environment", 400);
    const stripe = createStripeClient(environment as StripeEnv);

    // Resolve human-readable IDs to Stripe product IDs by listing all products and matching metadata.
    const results: Record<string, string> = {};
    let starting_after: string | undefined;
    while (true) {
      const page: any = await stripe.products.list({ limit: 100, ...(starting_after && { starting_after }) });
      for (const p of page.data) {
        const lovableId = p.metadata?.lovable_external_id;
        if (lovableId && TAX_CODES[lovableId]) {
          await stripe.products.update(p.id, { tax_code: TAX_CODES[lovableId] });
          results[lovableId] = TAX_CODES[lovableId];
        }
      }
      if (!page.has_more) break;
      starting_after = page.data[page.data.length - 1].id;
    }
    return new Response(JSON.stringify({ updated: results }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("set-tax-codes error", e);
    return jsonError("Internal server error", 500);
  }
});

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}