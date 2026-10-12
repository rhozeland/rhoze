import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function allowedReturn(raw: string) {
  try {
    const u = new URL(raw);
    if (["localhost", "127.0.0.1"].includes(u.hostname)) return true;
    if (u.protocol !== "https:") return false;
    return ["rhozeland.com", "www.rhozeland.com"].includes(u.hostname) || u.hostname.endsWith(".lovable.app");
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sign in to pay for this milestone." }, 401);

    const body = await req.json().catch(() => null);
    const milestoneId = body?.milestoneId;
    const env: StripeEnv = body?.environment;
    const returnUrl = body?.returnUrl;
    if (typeof milestoneId !== "string" || !/^[0-9a-f-]{36}$/.test(milestoneId)) return json({ error: "Invalid milestone" }, 400);
    if (env !== "sandbox" && env !== "live") return json({ error: "Invalid environment" }, 400);
    if (typeof returnUrl !== "string" || !allowedReturn(returnUrl)) return json({ error: "Invalid return URL" }, 400);

    const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: m } = await sb.from("release_milestones").select("*").eq("id", milestoneId).maybeSingle();
    if (!m) return json({ error: "Milestone not found" }, 404);
    const { data: r } = await sb.from("releases").select("id,title,user_id").eq("id", m.release_id).maybeSingle();
    if (!r || r.user_id !== user.id) return json({ error: "Only the project owner can pay." }, 403);
    if (m.status !== "planned") return json({ error: "This milestone is already paid." }, 400);
    if (m.amount_cents < 100) return json({ error: "Set a budget of at least $1 for this milestone first." }, 400);
    const { count } = await sb.from("release_milestones").select("id", { count: "exact", head: true })
      .eq("release_id", m.release_id).lt("position", m.position).eq("status", "planned");
    if ((count ?? 0) > 0) return json({ error: "Pay earlier milestones first." }, 400);

    const label = m.position === 0 ? `Deposit — ${m.title || "Milestone 1"}` : `Milestone ${m.position + 1} — ${m.title || "Untitled"}`;
    const stripe = createStripeClient(env);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      customer_email: user.email ?? undefined,
      line_items: [{
        quantity: 1,
        price_data: { currency: "cad", unit_amount: m.amount_cents, product_data: { name: `${r.title || "Project"} · ${label}`.slice(0, 250), tax_code: "txcd_20060000" } },
      }],
      metadata: { flow: "release_milestone", milestone_id: m.id, release_id: r.id },
    } as any);
    return json({ clientSecret: session.client_secret });
  } catch (e) {
    console.error("release-checkout failed", e);
    return json({ error: "Couldn't start checkout. Please try again." }, 500);
  }
});
