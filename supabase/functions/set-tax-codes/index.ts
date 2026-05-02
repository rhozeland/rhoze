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
// All Rhozeland services are creative/digital services → "Other services" (txcd_20030000).
// Subscriptions are general retainers → "Other services".
const TAX_CODES: Record<string, string> = {
  tier_bronze: "txcd_20030000",
  tier_gold: "txcd_20030000",
  tier_diamond: "txcd_20030000",
  alc_studio_rental: "txcd_20030000",
  alc_audio_recording: "txcd_20030000",
  alc_mixing: "txcd_20030000",
  alc_mastering: "txcd_20030000",
  alc_mv_edit: "txcd_20030000",
  alc_photo_shoot: "txcd_20030000",
  alc_podcast: "txcd_20030000",
  alc_design: "txcd_20030000",
  alc_consult: "txcd_20030000",
  project_deposit: "txcd_20030000",
  alc_content_edit: "txcd_20030000",
  alc_commercial_edit: "txcd_20030000",
  alc_short_form_edit: "txcd_20030000",
  alc_graphic_design: "txcd_20030000",
  alc_web_development: "txcd_20030000",
  alc_uiux_development: "txcd_20030000",
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
    return jsonError((e as Error).message || "failed", 500);
  }
});

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}