import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const Body = z.object({
  title: z.string().trim().min(1).max(120),
  project_type: z.enum(["artist", "brand"]).default("artist"),
  audience: z.string().trim().max(300).default(""),
  seed: z.string().trim().max(600).default(""),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "AI is not configured." }, 500);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid input" }, 400);
    const { title, project_type, audience, seed } = parsed.data;

    const prompt = `Write a short project brief for a ${project_type === "brand" ? "brand campaign" : "creative artist project"} at Rhozeland (Toronto creative studio).
Project name: ${title}
${audience ? `Audience: ${audience}` : ""}
${seed ? `Creator's notes so far: ${seed}` : ""}

Rules:
- 60 to 110 words, plain text, no headings, no bullet points, no markdown.
- First person plural is fine ("We're making…").
- Cover what is being made, the deliverables, the preferred style or mood, and any references or inspiration.
- Sound like a real creator wrote it: warm, specific, concrete. No buzzwords, no "leverage", no "elevate".
- Do not invent facts that contradict the notes; you may reasonably expand on them.`;

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: prompt,
        stream: true,
        reasoning: { effort: "low" },
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const t = await upstream.text().catch(() => "");
      if (upstream.status === 429) return json({ error: "Too many requests — try again in a moment." }, 429);
      if (upstream.status === 402) return json({ error: "AI credits are exhausted. Add credits in workspace settings." }, 402);
      console.error("gateway", upstream.status, t);
      return json({ error: "Could not generate a brief." }, upstream.status >= 500 ? 502 : upstream.status);
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

    const brief = text.replace(/\s+/g, " ").trim().slice(0, 600);
    if (!brief) return json({ error: "The AI returned an empty brief. Try again." }, 502);
    return json({ brief });
  } catch (e) {
    console.error(e);
    return json({ error: "Could not generate a brief." }, 500);
  }
});
