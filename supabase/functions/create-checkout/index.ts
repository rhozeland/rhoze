import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CartLine {
  priceId: string;
  quantity?: number;
}

interface Body {
  // For tier subscription checkout
  subscriptionPriceId?: string;
  // For à la carte / mixed cart one-time checkout
  cart?: CartLine[];
  // Custom-amount deposit (one-time)
  depositCents?: number;
  // Buyer info
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  customerCountry?: string;
  message?: string;
  // Optional link to existing client (when subscribing from inside the portal)
  userId?: string;
  projectId?: string;
  // Required
  returnUrl: string;
  environment: StripeEnv;
}

function isSafeId(s: string) {
  return /^[a-zA-Z0-9_-]+$/.test(s);
}

const MANAGED_PAYMENTS_COUNTRIES = new Set([
  "US","CA","BR","CL","CO","AR","PE","UY",
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
  "GB","NO","CH","IS","LI",
  "AU","NZ","KR","MY","TH","ID","PH","VN","IN","HK","TW",
  "AE","SA","ZA","IL","TR","EG","NG","KE",
  "GI","BH","GE","KZ","BD","PK","LK","MM","KH","LA",
  "RS","BA","ME","MK","AL","MD","AM",
]);

function shouldUseManagedPayments(country?: string): boolean {
  if (!country) return false;
  return MANAGED_PAYMENTS_COUNTRIES.has(country.toUpperCase());
}

async function handle(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  let body: Body;
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }

  if (!body.returnUrl || (body.environment !== "sandbox" && body.environment !== "live")) {
    return jsonError("returnUrl and environment are required", 400);
  }

  const stripe = createStripeClient(body.environment);
  const useManaged = shouldUseManagedPayments(body.customerCountry);

  try {
    // ----- Subscription checkout -----
    if (body.subscriptionPriceId) {
      if (!isSafeId(body.subscriptionPriceId)) return jsonError("Invalid subscriptionPriceId", 400);
      const prices = await stripe.prices.list({ lookup_keys: [body.subscriptionPriceId] });
      if (!prices.data.length) return jsonError("Price not found", 400);
      const price = prices.data[0];
      if (price.type !== "recurring") return jsonError("Not a subscription price", 400);

      const metadata: Record<string, string> = {
        flow: "subscription",
        tier_price_id: body.subscriptionPriceId,
      };
      if (body.userId) metadata.userId = body.userId;
      if (body.customerName) metadata.customer_name = body.customerName;
      if (body.customerPhone) metadata.customer_phone = body.customerPhone;
      if (body.customerCountry) metadata.customer_country = body.customerCountry;
      if (body.message) metadata.message = body.message.slice(0, 480);
      if (body.projectId) metadata.project_id = body.projectId;
      metadata.managed_payments = useManaged ? "true" : "false";

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: price.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: body.returnUrl,
        ...(body.customerEmail && { customer_email: body.customerEmail }),
        metadata,
        subscription_data: { metadata },
        ...(useManaged
          ? { managed_payments: { enabled: true } }
          : { automatic_tax: { enabled: true } }),
      } as any);
      return jsonOk({ clientSecret: session.client_secret });
    }

    // ----- One-time checkout (cart and/or deposit) -----
    const lineItems: any[] = [];

    if (body.cart && body.cart.length) {
      for (const item of body.cart) {
        if (!isSafeId(item.priceId)) return jsonError(`Invalid priceId: ${item.priceId}`, 400);
        const prices = await stripe.prices.list({ lookup_keys: [item.priceId] });
        if (!prices.data.length) return jsonError(`Price not found: ${item.priceId}`, 400);
        if (prices.data[0].type !== "one_time") return jsonError(`Not a one-time price: ${item.priceId}`, 400);
        lineItems.push({ price: prices.data[0].id, quantity: Math.max(1, Math.min(50, item.quantity ?? 1)) });
      }
    }

    if (body.depositCents && body.depositCents > 0) {
      if (body.depositCents < 5000) return jsonError("Deposit must be at least $50", 400);
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Project deposit", tax_code: "txcd_20030000" },
          unit_amount: Math.floor(body.depositCents),
        },
        quantity: 1,
      });
    }

    if (!lineItems.length) return jsonError("Cart is empty", 400);

    const metadata: Record<string, string> = {
      flow: "intake_one_time",
    };
    if (body.customerName) metadata.customer_name = body.customerName;
    if (body.customerPhone) metadata.customer_phone = body.customerPhone;
    if (body.customerCountry) metadata.customer_country = body.customerCountry;
    if (body.message) metadata.message = body.message.slice(0, 480);
    if (body.userId) metadata.userId = body.userId;
    if (body.projectId) metadata.project_id = body.projectId;
    if (body.depositCents) metadata.deposit_cents = String(body.depositCents);
    if (body.cart && body.cart.length) {
      metadata.cart = JSON.stringify(body.cart).slice(0, 480);
    }
    metadata.managed_payments = useManaged ? "true" : "false";

    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: body.returnUrl,
      ...(body.customerEmail && { customer_email: body.customerEmail }),
      metadata,
      ...(useManaged
        ? { managed_payments: { enabled: true } }
        : { automatic_tax: { enabled: true } }),
    } as any);
    return jsonOk({ clientSecret: session.client_secret });
  } catch (e) {
    console.error("create-checkout error", e);
    return jsonError((e as Error).message || "Checkout failed", 500);
  }
}

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(handle);