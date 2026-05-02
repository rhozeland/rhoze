import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  source: "start" | "contact";
  category?: string; // contact category: project | technical | general
  name: string;
  email: string;
  phone?: string;
  company?: string;
  region?: string;
  message?: string;
  fields?: Record<string, unknown>; // arbitrary additional form fields for the activity body
  tags?: string[];
}

function bad(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad(405, "method not allowed");

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return bad(400, "invalid json");
  }

  const name = (body.name || "").trim().slice(0, 200);
  const email = (body.email || "").trim().toLowerCase().slice(0, 320);
  const phone = (body.phone || "").trim().slice(0, 60) || null;
  const company = (body.company || "").trim().slice(0, 200) || null;
  const message = (body.message || "").slice(0, 4000);
  const source = body.source === "contact" ? "contact" : "start";
  const category = (body.category || "").trim().slice(0, 60);

  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return bad(400, "name and a valid email are required");
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const tags = Array.from(
    new Set([
      `source:${source}`,
      ...(category ? [`category:${category}`] : []),
      ...(body.region ? [`region:${body.region}`] : []),
      ...(body.tags || []).map((t) => String(t).slice(0, 40)),
    ]),
  );

  // Upsert contact by email (case-insensitive). Try to update existing first.
  const { data: existing } = await sb
    .from("contacts")
    .select("id, tags, name, phone, company")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  let contactId: string | null = existing?.id ?? null;

  if (contactId) {
    const merged = Array.from(new Set([...(existing?.tags || []), ...tags]));
    await sb
      .from("contacts")
      .update({
        name: existing?.name || name,
        phone: existing?.phone || phone,
        company: existing?.company || company,
        tags: merged,
        last_visit: new Date().toISOString().slice(0, 10),
      })
      .eq("id", contactId);
  } else {
    const { data: inserted, error: insErr } = await sb
      .from("contacts")
      .insert({
        name,
        email,
        phone,
        company,
        type: "lead",
        source,
        tags,
        first_visit: new Date().toISOString().slice(0, 10),
        last_visit: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (insErr) {
      console.error("contact insert failed", insErr);
      return bad(500, "could not save contact");
    }
    contactId = inserted.id;
  }

  // Build activity body
  const lines: string[] = [];
  if (source === "start") {
    lines.push("Public /start funnel — captured at review step (pre-checkout).");
  } else {
    lines.push(`Public /contact form submission${category ? ` (${category})` : ""}.`);
  }
  lines.push("");
  lines.push(`Name: ${name}`);
  lines.push(`Email: ${email}`);
  if (phone) lines.push(`Phone: ${phone}`);
  if (company) lines.push(`Company: ${company}`);
  if (body.region) lines.push(`Region: ${body.region}`);
  if (body.fields && Object.keys(body.fields).length) {
    lines.push("");
    for (const [k, v] of Object.entries(body.fields)) {
      if (v === null || v === undefined || v === "") continue;
      lines.push(`${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
    }
  }
  if (message) {
    lines.push("");
    lines.push("Message:");
    lines.push(message);
  }

  const subject =
    source === "start"
      ? `New /start lead — ${name}`
      : `New /contact ${category || "inquiry"} — ${name}`;

  await sb.from("activities").insert({
    contact_id: contactId,
    type: "note",
    subject: subject.slice(0, 200),
    body: lines.join("\n").slice(0, 8000),
  });

  return new Response(JSON.stringify({ ok: true, contact_id: contactId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});