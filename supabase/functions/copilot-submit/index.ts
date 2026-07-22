// Commits a copilot conversation as an intake_requests row and marks the convo submitted.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { conversation_id, guest_token, contact_name, contact_email, contact_phone } = await req.json() as {
      conversation_id: string;
      guest_token?: string;
      contact_name: string;
      contact_email: string;
      contact_phone?: string;
    };

    if (!conversation_id || !contact_name || !contact_email) {
      return json({ error: "conversation_id, contact_name, contact_email required" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: u } = await anon.auth.getUser();
      userId = u.user?.id ?? null;
    }

    const { data: convo, error: convoErr } = await admin
      .from("copilot_conversations")
      .select("*")
      .eq("id", conversation_id)
      .maybeSingle();
    if (convoErr || !convo) return json({ error: "conversation not found" }, 404);

    const owns =
      (userId && convo.user_id === userId) ||
      (guest_token && convo.guest_token === guest_token);
    if (!owns) return json({ error: "forbidden" }, 403);

    const { data: msgs } = await admin
      .from("copilot_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at");

    const transcript = (msgs ?? [])
      .map((m) => `[${m.role}] ${m.content}`)
      .join("\n\n");

    const brief = convo.brief_json ?? {};
    const message = [
      `PATHWAY: ${convo.recommended_pathway ?? "unspecified"}`,
      brief.project_type ? `TYPE: ${brief.project_type}` : "",
      brief.summary ? `SUMMARY: ${brief.summary}` : "",
      brief.deliverables?.length ? `DELIVERABLES: ${brief.deliverables.join(", ")}` : "",
      brief.references?.length ? `REFERENCES: ${brief.references.join(", ")}` : "",
      convo.estimate_low_cents
        ? `ESTIMATE: $${(convo.estimate_low_cents / 100).toFixed(0)} – $${((convo.estimate_high_cents ?? convo.estimate_low_cents) / 100).toFixed(0)}`
        : "",
      convo.timeline_weeks_low
        ? `TIMELINE: ${convo.timeline_weeks_low}–${convo.timeline_weeks_high ?? convo.timeline_weeks_low} weeks`
        : "",
      "",
      "--- CONVERSATION ---",
      transcript,
    ].filter(Boolean).join("\n");

    const { data: intake, error: intakeErr } = await admin
      .from("intake_requests")
      .insert({
        contact_name,
        contact_email,
        contact_phone: contact_phone ?? null,
        cart: [],
        message,
        contract_accepted: false,
        deposit_cents: 0,
        subscribe_monthly: convo.recommended_pathway === "subscribe",
        status: "new",
        total_cents: convo.estimate_low_cents ?? 0,
      })
      .select("id")
      .single();

    if (intakeErr || !intake) return json({ error: intakeErr?.message ?? "intake insert failed" }, 500);

    await admin
      .from("copilot_conversations")
      .update({ status: "submitted", submitted_intake_id: intake.id })
      .eq("id", conversation_id);

    return json({ ok: true, intake_id: intake.id });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}