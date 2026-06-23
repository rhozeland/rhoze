// Public edge function: scrapes the latest uploads from @Rhozeland's YouTube channel.
// RSS feeds 404 for this channel, so we parse ytInitialData from the /videos page.
const CHANNEL_URL = "https://www.youtube.com/@Rhozeland/videos";
const LIVE_URL = "https://www.youtube.com/@Rhozeland/streams";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function decode(s: string) {
  return s.replace(/\\u0026/g, "&").replace(/\\"/g, '"').replace(/\\\//g, "/");
}

function scrapeVideos(html: string) {
  const out: any[] = [];
  const seen = new Set<string>();
  // Each upload is wrapped in a lockupViewModel block.
  const blockRe = /"lockupViewModel":\{([\s\S]*?)"lockupMetadataViewModel":\{([\s\S]*?)\}\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const head = m[1];
    const meta = m[2];
    const idMatch = head.match(/i\.ytimg\.com\/vi\/([\w-]{11})\//);
    if (!idMatch) continue;
    const id = idMatch[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const titleMatch = meta.match(/"title":\{"content":"((?:[^"\\]|\\.)+)"/);
    if (!titleMatch) continue;
    const title = decode(titleMatch[1]);
    // Last "ago" / "Streamed" text is the published string
    const agoMatches = [...meta.matchAll(/"content":"([^"]*?\bago)"/g)];
    const streamedMatch = meta.match(/"content":"(Streamed [^"]+)"/);
    const published = streamedMatch ? streamedMatch[1] : (agoMatches.length ? agoMatches[agoMatches.length - 1][1] : "");
    const live = /THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE|\bLIVE NOW\b|"text":"LIVE"/i.test(head);
    out.push({ id, title, published, live });
    if (out.length >= 12) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";
    const [vidsRes, liveRes] = await Promise.all([
      fetch(CHANNEL_URL, { headers: { "User-Agent": ua, "Accept-Language": "en-US,en;q=0.9" } }),
      fetch(LIVE_URL, { headers: { "User-Agent": ua, "Accept-Language": "en-US,en;q=0.9" } }).catch(() => null),
    ]);
    if (!vidsRes.ok) throw new Error(`upstream ${vidsRes.status}`);
    const videos = scrapeVideos(await vidsRes.text()).slice(0, 8);
    // Check live section: if any item there has style LIVE, mark it on top.
    let liveNow: any = null;
    if (liveRes && liveRes.ok) {
      const liveItems = scrapeVideos(await liveRes.text());
      const onAir = liveItems.find((v) => v.live);
      if (onAir) liveNow = onAir;
    }
    if (liveNow) {
      const idx = videos.findIndex((v) => v.id === liveNow.id);
      if (idx >= 0) videos.splice(idx, 1);
      videos.unshift({ ...liveNow, live: true });
    }
    return new Response(JSON.stringify({ videos }), {
      headers: {
        ...corsHeaders,
        "content-type": "application/json",
        "cache-control": "public, max-age=600, s-maxage=600",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), videos: [] }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
