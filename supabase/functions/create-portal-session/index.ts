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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  try {
    const { returnUrl, environment } = await req.json();
    if (environment !== "sandbox" && environment !== "live") {
      return new Response(JSON.stringify({ error: "invalid environment" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const env: StripeEnv = environment;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token!);
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let customerId = sub?.stripe_customer_id as string | undefined;

    // Fallback: anonymous subscription that was linked via project_clients
    // (e.g. buyer subscribed before signing up, then redeemed a project code).
    if (!customerId) {
      const { data: memberships } = await supabase
        .from("project_clients")
        .select("project_id")
        .eq("user_id", user.id);
      const projectIds = (memberships ?? []).map((m: any) => m.project_id);
      if (projectIds.length > 0) {
        const { data: linked } = await supabase
          .from("subscriptions")
          .select("stripe_customer_id")
          .eq("environment", env)
          .in("project_id", projectIds)
          .not("stripe_customer_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        customerId = linked?.stripe_customer_id as string | undefined;
      }
    }

    if (!customerId) {
      return new Response(JSON.stringify({ error: "no subscription found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const stripe = createStripeClient(env);
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      ...(returnUrl && { return_url: returnUrl }),
    });
    return new Response(JSON.stringify({ url: portal.url }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("portal error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});