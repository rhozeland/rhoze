// Transcribes an uploaded audio blob via Lovable AI gateway (gpt-4o-transcribe).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "file required" }, 400);
    if (file.size < 512) return json({ error: "Recording too short — try again." }, 400);
    if (file.size > 24 * 1024 * 1024) return json({ error: "Recording too large (max 24MB)." }, 413);

    const upstream = new FormData();
    upstream.append("model", "openai/gpt-4o-transcribe");
    // Name the file for its container so OpenAI accepts it.
    const mime = file.type.split(";")[0];
    const ext = ({
      "audio/webm": "webm",
      "audio/mp4": "mp4",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
      "audio/ogg": "ogg",
    } as Record<string, string>)[mime] ?? "webm";
    upstream.append("file", file, `recording.${ext}`);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: upstream,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (res.status === 429) return json({ error: "Rate limit exceeded. Try again in a moment." }, 429);
      if (res.status === 402) return json({ error: "AI credits exhausted." }, 402);
      return json({ error: errText || "transcription failed" }, res.status);
    }

    const data = await res.json();
    return json({ text: data.text ?? "" });
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