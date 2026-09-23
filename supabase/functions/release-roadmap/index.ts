import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const Body = z.object({
  title: z.string().trim().min(1).max(120),
  answers: z.record(z.string().max(600)).default({}),
  budget_cents: z.number().int().min(0).max(100_000_000_000),
  artist_pct: z.number().min(0).max(100),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["milestones"],
  properties: {
    milestones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "deliverable", "amount_cents"],
        properties: {
          title: { type: "string" },
          deliverable: { type: "string" },
          amount_cents: { type: "integer" },
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "AI is not configured." }, 500);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }, 400);
    const { title, answers, budget_cents } = parsed.data;

    const prompt = `Create a production roadmap for a creative project at Rhozeland (Toronto creative studio).
Project: ${title}
Intake answers: ${JSON.stringify(answers)}
Total budget: ${(budget_cents / 100).toFixed(2)} CAD.
Return between 3 and 5 milestones in chronological order. Each: a short title (max 6 words), one concrete deliverable (max 18 words), and amount_cents. The amounts must be whole cents and sum EXACTLY to ${budget_cents}.`;

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: prompt,
        stream: true,
        reasoning: { effort: "low" },
        text: { format: { type: "json_schema", name: "roadmap", strict: true, schema } },
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const t = await upstream.text().catch(() => "");
      if (upstream.status === 429) return json({ error: "Too many requests — try again in a moment." }, 429);
      if (upstream.status === 402) return json({ error: "AI credits are exhausted. Add credits in workspace settings." }, 402);
      console.error("gateway", upstream.status, t);
      return json({ error: "Could not generate a roadmap." }, upstream.status >= 500 ? 502 : upstream.status);
    }

    const reader = upstream.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const ev = JSON.parse(data);
          if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
        } catch { /* ignore */ }
      }
    }

    let milestones: { title: string; deliverable: string; amount_cents: number }[] = [];
    try { milestones = JSON.parse(text).milestones ?? []; } catch { /* fallthrough */ }
    milestones = milestones.slice(0, 5).map((m) => ({
      title: String(m.title).slice(0, 80),
      deliverable: String(m.deliverable).slice(0, 200),
      amount_cents: Math.max(0, Math.round(Number(m.amount_cents) || 0)),
    }));
    if (milestones.length < 3) return json({ error: "The AI returned an incomplete roadmap. Try again." }, 502);

    // Normalize so rows sum to the budget exactly.
    const sum = milestones.reduce((s, m) => s + m.amount_cents, 0);
    if (budget_cents > 0 && sum !== budget_cents) {
      let acc = 0;
      milestones = milestones.map((m, idx) => {
        const amt = idx === milestones.length - 1
          ? budget_cents - acc
          : Math.round(sum > 0 ? (m.amount_cents / sum) * budget_cents : budget_cents / milestones.length);
        acc += amt;
        return { ...m, amount_cents: amt };
      });
    }
    return json({ milestones });
  } catch (e) {
    console.error(e);
    return json({ error: "Could not generate a roadmap." }, 500);
  }
});
