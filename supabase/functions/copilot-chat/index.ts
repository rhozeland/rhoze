// Copilot chat streaming endpoint. Streams SSE from Lovable AI Gateway.
// After the stream completes, extracts any structured brief update the
// model returned in a fenced ```brief JSON block and persists it plus
// the assistant turn.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are the Rhoze Studio Concierge — a warm, grounded creative producer who helps clients scope projects with Rhozeland (a creator studio: music videos, campaigns, editing, design, dev).

Voice: calm, curious, direct. No hype. Short messages (1–3 sentences). Ask ONE question at a time unless the client just dumped a lot of context.

Your job across the conversation:
1. Understand the project (what, who it's for, deliverables, references, timeline, budget).
2. As you learn, keep a live structured brief.
3. When you have enough, recommend a pathway: "subscribe" (ongoing monthly retainer), "build" (scoped one-off project), or "request" (48h rapid brief for tiny/uncertain scopes).

CRITICAL FORMAT: After your natural reply, on a new line, output a fenced code block tagged \`brief\` containing ONLY the JSON fields you can now confidently fill or update. Never wrap it in prose. Use this shape (all fields optional — only include what you know):

\`\`\`brief
{
  "project_type": "music video | short film | campaign | photo | edit | design | dev | other",
  "summary": "one-sentence plain description",
  "audience": "who it's for",
  "deliverables": ["item", "item"],
  "references": ["url or short note"],
  "timeline_weeks_low": 2,
  "timeline_weeks_high": 4,
  "budget_low_cents": 300000,
  "budget_high_cents": 800000,
  "recommended_pathway": "subscribe | build | request",
  "readiness": 0.0
}
\`\`\`

"readiness" is 0–1 — how close the brief is to being submittable. Bump it as fields fill in. When readiness ≥ 0.7, invite the client to continue with the recommended pathway.

Never invent client details. If they haven't said something, leave the field out.`;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { conversation_id, guest_token, messages } = await req.json() as {
      conversation_id: string;
      guest_token?: string;
      messages: ChatMessage[];
    };

    if (!conversation_id || !Array.isArray(messages)) {
      return json({ error: "conversation_id and messages required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify conversation ownership (auth user or guest_token)
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
      .select("id, user_id, guest_token, brief_json")
      .eq("id", conversation_id)
      .maybeSingle();

    if (convoErr || !convo) return json({ error: "conversation not found" }, 404);
    const owns =
      (userId && convo.user_id === userId) ||
      (guest_token && convo.guest_token === guest_token);
    if (!owns) return json({ error: "forbidden" }, 403);

    // Persist the latest user message (the last one in the array) if not yet saved.
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      await admin.from("copilot_messages").insert({
        conversation_id,
        role: "user",
        content: lastUser.content,
      });
    }

    // Call Lovable AI Gateway (streaming SSE)
    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => "");
      if (upstream.status === 429) return json({ error: "Rate limit exceeded. Try again in a moment." }, 429);
      if (upstream.status === 402) return json({ error: "AI credits exhausted. Add credits to continue." }, 402);
      return json({ error: errText || "AI gateway error" }, upstream.status);
    }

    // Tee the stream: forward SSE to client, and collect full text in the background
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            // parse SSE deltas for text content
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (payload === "[DONE]") continue;
              try {
                const j = JSON.parse(payload);
                const delta = j.choices?.[0]?.delta?.content;
                if (typeof delta === "string") fullText += delta;
              } catch { /* ignore */ }
            }
            controller.enqueue(value);
          }
          controller.close();

          // After stream finishes: extract brief JSON and persist
          const { visible, brief } = splitReplyAndBrief(fullText);
          await admin.from("copilot_messages").insert({
            conversation_id,
            role: "assistant",
            content: visible,
          });

          if (brief && typeof brief === "object") {
            const merged = { ...(convo.brief_json ?? {}), ...brief };
            const update: Record<string, unknown> = { brief_json: merged };
            if (typeof brief.recommended_pathway === "string") {
              update.recommended_pathway = brief.recommended_pathway;
            }
            if (typeof brief.budget_low_cents === "number") update.estimate_low_cents = brief.budget_low_cents;
            if (typeof brief.budget_high_cents === "number") update.estimate_high_cents = brief.budget_high_cents;
            if (typeof brief.timeline_weeks_low === "number") update.timeline_weeks_low = brief.timeline_weeks_low;
            if (typeof brief.timeline_weeks_high === "number") update.timeline_weeks_high = brief.timeline_weeks_high;
            await admin.from("copilot_conversations").update(update).eq("id", conversation_id);
          }
        } catch (e) {
          console.error("copilot-chat stream error", e);
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
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

function splitReplyAndBrief(full: string): { visible: string; brief: any | null } {
  const m = full.match(/```brief\s*([\s\S]*?)```/);
  if (!m) return { visible: full.trim(), brief: null };
  const jsonText = m[1].trim();
  let brief: any = null;
  try { brief = JSON.parse(jsonText); } catch { /* ignore */ }
  const visible = full.replace(m[0], "").trim();
  return { visible, brief };
}