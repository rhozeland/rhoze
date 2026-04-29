// Admin-only: force an immediate tier switch on a subscription with proration + credit top-up.
// The standard flow queues changes for the next billing cycle; this is the override.
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

const TIER_PRICE: Record<string, string> = {
  bronze: "tier_bronze_monthly",
  gold: "tier_gold_monthly",
  diamond: "tier_diamond_monthly",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token!);
    if (!user) return j({ error: "unauthorized" }, 401);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) return j({ error: "admin only" }, 403);

    const { projectId, newTierSlug, environment, immediate, topUpCredits } = await req.json();
    if (!projectId || !newTierSlug || !TIER_PRICE[newTierSlug]) return j({ error: "missing/invalid params" }, 400);
    if (environment !== "sandbox" && environment !== "live") return j({ error: "invalid environment" }, 400);
    const env: StripeEnv = environment;

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id, stripe_subscription_id, price_id")
      .eq("project_id", projectId)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();

    if (!sub) return j({ error: "no subscription found for project" }, 404);

    const stripe = createStripeClient(env);
    const newLookup = TIER_PRICE[newTierSlug];
    const prices = await stripe.prices.list({ lookup_keys: [newLookup] });
    if (!prices.data.length) return j({ error: "new price not found" }, 400);

    // Fetch current subscription to get the item ID
    const stripeSub: any = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const itemId = stripeSub.items.data[0].id;

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: itemId, price: prices.data[0].id }],
      proration_behavior: immediate ? "create_prorations" : "none",
      ...(immediate ? {} : { billing_cycle_anchor: "unchanged" as any }),
    } as any);

    if (immediate) {
      // Mark project active tier immediately and top up credits if requested
      await supabase.from("projects").update({
        active_tier_slug: newTierSlug,
        pending_tier_slug: null,
        pending_change_at: null,
      }).eq("id", projectId);
      if (topUpCredits) {
        await supabase.rpc("apply_tier_credits", { _project_id: projectId, _tier_slug: newTierSlug });
      }
    } else {
      // Queue for next cycle
      await supabase.from("projects").update({
        pending_tier_slug: newTierSlug,
      }).eq("id", projectId);
    }
    return j({ ok: true, immediate: !!immediate });
  } catch (e) {
    console.error("admin-change-tier", e);
    return j({ error: (e as Error).message }, 500);
  }
});
function j(d: unknown, status = 200) {
  return new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}