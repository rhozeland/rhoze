// Public edge function: scrapes the latest uploads from @Rhozeland's YouTube channel.
// RSS feeds 404 for this channel, so we parse ytInitialData from the /videos page.
const CHANNEL_URL = "https://www.youtube.com/@Rhozeland/videos";
const LIVE_URL = "https://www.youtube.com/@Rhozeland/streams";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function scrapeVideos(html: string, isLiveSection = false) {
  const out: any[] = [];
  const seen = new Set<string>();
  // Match richItemRenderer blocks → each contains videoId + title + publishedTimeText + (optional) badges (LIVE)
  const itemRe = /"videoRenderer":\{[\s\S]*?"videoId":"([a-zA-Z0-9_-]{11})"[\s\S]*?"title":\{(?:"runs":\[\{"text":"([^"]+)"|"simpleText":"([^"]+)")[\s\S]*?(?:"publishedTimeText":\{"simpleText":"([^"]+)"\})?[\s\S]*?(?:"thumbnailOverlayTimeStatusRenderer":\{[\s\S]*?"style":"([A-Z]+)")?/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(html)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const title = (m[2] || m[3] || "").replace(/\\u0026/g, "&").replace(/\\"/g, '"');
    const published = m[4] || "";
    const style = m[5] || "";
    out.push({
      id,
      title,
      published, // human string like "2 days ago" — RSS-style ISO not available from scrape
      live: isLiveSection || style === "LIVE",
    });
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
    const videos = scrapeVideos(await vidsRes.text(), false).slice(0, 8);
    // Check live section: if any item there has style LIVE, mark it on top.
    let liveNow: any = null;
    if (liveRes && liveRes.ok) {
      const liveItems = scrapeVideos(await liveRes.text(), false);
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
