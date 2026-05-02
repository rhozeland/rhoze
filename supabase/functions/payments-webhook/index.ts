import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, verifyWebhook } from "../_shared/stripe.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
  }
  return _supabase;
}

function tierSlugFromPriceId(priceId: string | undefined): string | null {
  if (!priceId) return null;
  if (priceId.startsWith("tier_bronze")) return "bronze";
  if (priceId.startsWith("tier_gold")) return "gold";
  if (priceId.startsWith("tier_diamond")) return "diamond";
  return null;
}

function genProjectCode(): string {
  const block = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RHZ-${block()}-${block()}`;
}

const PORTAL_URL = "https://www.rhozeland.com/team.html#/client";

async function sendProjectCodeEmail(opts: {
  recipientEmail: string;
  name: string | null;
  projectCode: string;
  projectId: string;
  kind: "subscription" | "one_time";
}) {
  if (!opts.recipientEmail) {
    console.log("skip project-code email — no recipient", opts.projectId);
    return;
  }
  try {
    const { error } = await getSupabase().functions.invoke("send-transactional-email", {
      body: {
        templateName: "project-code-delivery",
        recipientEmail: opts.recipientEmail,
        idempotencyKey: `project-code-${opts.projectId}`,
        templateData: {
          name: opts.name ?? undefined,
          projectCode: opts.projectCode,
          portalUrl: PORTAL_URL,
          kind: opts.kind,
        },
      },
    });
    if (error) console.error("send project-code email failed", error);
  } catch (e) {
    console.error("send project-code email threw", e);
  }
}

async function handleSubscriptionCreated(subscription: any, env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const stripePriceId = item?.price?.id;
  const lookupKey = item?.price?.lookup_key
    ?? item?.price?.metadata?.lovable_external_id
    ?? stripePriceId;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const userId = subscription.metadata?.userId ?? null;
  const tierSlug = tierSlugFromPriceId(lookupKey);

  const sb = getSupabase();

  // Find or create the project for this subscription
  let projectId: string | null = subscription.metadata?.project_id ?? null;
  let createdProjectCode: string | null = null;
  let createdClientName: string | null = null;
  let createdClientEmail: string | null = null;
  if (!projectId) {
    const code = genProjectCode();
    const clientName = subscription.metadata?.customer_name ?? "New client";
    const { data: project, error } = await sb.from("projects").insert({
      title: `${tierSlug ? tierSlug[0].toUpperCase() + tierSlug.slice(1) : "Subscription"} project for ${clientName}`,
      client_name: clientName,
      client_email: subscription.metadata?.customer_email ?? null,
      client_phone: subscription.metadata?.customer_phone ?? null,
      status: "active",
      project_code: code,
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      active_tier_slug: tierSlug,
      notes: subscription.metadata?.message ?? null,
    }).select("id").single();
    if (error) {
      console.error("project insert failed", error);
    } else {
      projectId = project.id;
      createdProjectCode = code;
      createdClientName = clientName;
      createdClientEmail = subscription.metadata?.customer_email ?? null;
      if (tierSlug && projectId) {
        await sb.rpc("apply_tier_credits", { _project_id: projectId, _tier_slug: tierSlug });
      }
    }
  }

  await sb.from("subscriptions").upsert({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer,
    product_id: productId ?? "",
    price_id: lookupKey ?? "",
    status: subscription.status,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    environment: env,
    project_id: projectId,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    updated_at: new Date().toISOString(),
  }, { onConflict: "stripe_subscription_id" });

  // Deliver project code via email — only on first creation, not on every webhook retry.
  if (createdProjectCode && projectId && createdClientEmail) {
    await sendProjectCodeEmail({
      recipientEmail: createdClientEmail,
      name: createdClientName,
      projectCode: createdProjectCode,
      projectId,
      kind: "subscription",
    });
  }
}

async function handleSubscriptionUpdated(subscription: any, env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const stripePriceId = item?.price?.id;
  const lookupKey = item?.price?.lookup_key
    ?? item?.price?.metadata?.lovable_external_id
    ?? stripePriceId;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  const sb = getSupabase();

  // Look up the existing row to detect tier changes
  const { data: existing } = await sb
    .from("subscriptions")
    .select("id, price_id, project_id")
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env)
    .maybeSingle();

  await sb.from("subscriptions").update({
    status: subscription.status,
    product_id: productId ?? "",
    price_id: lookupKey ?? "",
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    updated_at: new Date().toISOString(),
  }).eq("stripe_subscription_id", subscription.id).eq("environment", env);

  // If the price changed and there's a project linked, this is a tier change.
  // Default behavior: switch at period end → record as `pending_tier_slug` on the project.
  // But Stripe applies the price change immediately on the subscription object — so
  // we ONLY queue when the immediate switch was NOT requested by the admin
  // (admin can update the project's `active_tier_slug` directly via the UI to force immediate).
  if (existing && existing.price_id !== lookupKey && existing.project_id) {
    const newSlug = tierSlugFromPriceId(lookupKey);
    if (newSlug) {
      // Only set pending if it differs from the project's current active tier
      const { data: proj } = await sb.from("projects").select("active_tier_slug").eq("id", existing.project_id).maybeSingle();
      if (proj && proj.active_tier_slug !== newSlug) {
        await sb.from("projects").update({
          pending_tier_slug: newSlug,
          pending_change_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        }).eq("id", existing.project_id);
      }
    }
  }
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  const sb = getSupabase();
  const periodEnd = subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end;
  await sb.from("subscriptions").update({
    status: "canceled",
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("stripe_subscription_id", subscription.id).eq("environment", env);

  // Run archival sweep (will only flip projects whose period_end is already past)
  await sb.rpc("archive_expired_projects");
}

async function handleInvoicePaid(invoice: any, env: StripeEnv) {
  // New billing cycle for an existing subscription → reissue tier credits and apply pending tier change
  if (invoice.billing_reason !== "subscription_cycle" && invoice.billing_reason !== "subscription_update") return;
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;
  const sb = getSupabase();
  const { data: sub } = await sb
    .from("subscriptions")
    .select("id, project_id, price_id")
    .eq("stripe_subscription_id", subscriptionId)
    .eq("environment", env)
    .maybeSingle();
  if (!sub || !sub.project_id) return;
  // Apply any pending tier change first
  await sb.rpc("apply_pending_tier_change", { _subscription_id: sub.id });
  // Then issue this period's credits based on the (possibly new) active_tier_slug
  const { data: proj } = await sb.from("projects").select("active_tier_slug").eq("id", sub.project_id).maybeSingle();
  if (proj?.active_tier_slug) {
    await sb.rpc("apply_tier_credits", { _project_id: sub.project_id, _tier_slug: proj.active_tier_slug });
  }
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  // We only act on one-time payment sessions here — subscription sessions are handled
  // by customer.subscription.created.
  if (session.mode !== "payment") return;

  // Project top-up → credit the existing project's balance, do NOT create a new intake.
  if (session.metadata?.flow === "project_topup") {
    const sb = getSupabase();
    const projectId = session.metadata?.project_id;
    if (!projectId) {
      console.error("project_topup missing project_id", session.id);
      return;
    }
    const dollarCents = Number(session.metadata?.topup_dollars_cents ?? 0);
    const credits = Number(session.metadata?.topup_credits ?? 0);
    const label = session.metadata?.label || "Top-up";
    const { error } = await sb.rpc("apply_project_topup", {
      _project_id: projectId,
      _dollar_cents: dollarCents,
      _credits: credits,
      _label: label,
      _stripe_session_id: session.id,
      _stripe_payment_intent_id: session.payment_intent ?? null,
    });
    if (error) console.error("apply_project_topup failed", error);
    else console.log("project top-up applied", projectId, label);
    return;
  }

  if (session.metadata?.flow !== "intake_one_time") return;

  const sb = getSupabase();
  const cart = session.metadata?.cart ? JSON.parse(session.metadata.cart) : [];
  const depositCents = Number(session.metadata?.deposit_cents ?? 0);
  const totalCents = session.amount_total ?? (depositCents + 0);

  const { data: intake } = await sb.from("intake_requests").insert({
    contact_name: session.metadata?.customer_name ?? session.customer_details?.name ?? "Guest",
    contact_email: session.customer_details?.email ?? session.metadata?.customer_email ?? "",
    contact_phone: session.metadata?.customer_phone ?? session.customer_details?.phone ?? null,
    cart,
    deposit_cents: depositCents,
    total_cents: totalCents,
    contract_accepted: true,
    contract_accepted_at: new Date().toISOString(),
    message: session.metadata?.message ?? null,
    stripe_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent ?? null,
    status: "paid",
    paid_at: new Date().toISOString(),
  }).select("id").single();

  console.log("intake created from checkout", intake?.id, "session", session.id);

  // Auto-convert paid intake into a project so the buyer gets a project_code immediately.
  if (intake?.id) {
    const { data: projectId, error: convErr } = await sb.rpc("create_project_from_intake", { _intake_id: intake.id });
    if (convErr) {
      console.error("create_project_from_intake failed", convErr);
    } else {
      console.log("project auto-created from intake", projectId);
      // Look up the freshly-generated project_code and email it to the buyer.
      if (projectId) {
        const { data: proj } = await sb
          .from("projects")
          .select("project_code, client_email, client_name")
          .eq("id", projectId as string)
          .maybeSingle();
        if (proj?.project_code && proj?.client_email) {
          await sendProjectCodeEmail({
            recipientEmail: proj.client_email as string,
            name: (proj.client_name as string) ?? null,
            projectCode: proj.project_code as string,
            projectId: projectId as string,
            kind: "one_time",
          });
        }
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("invalid env query param", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
  const env: StripeEnv = rawEnv;
  try {
    const event = await verifyWebhook(req, env);
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object, env); break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object, env); break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object, env); break;
      case "invoice.paid":
      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object, env); break;
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, env); break;
      default:
        console.log("Unhandled event:", event.type);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});