// Public edge function: proxies Rhozeland's YouTube RSS feed (no API key, cached 10 min).
const CHANNEL_ID = "UCv1XLhcDG8YIk1spe2J3TqQ";
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function parseFeed(xml: string) {
  const entries: any[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];
    const idMatch = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = block.match(/<title>([^<]+)<\/title>/);
    const publishedMatch = block.match(/<published>([^<]+)<\/published>/);
    if (!idMatch) continue;
    const title = titleMatch ? titleMatch[1] : "";
    entries.push({
      id: idMatch[1],
      title,
      published: publishedMatch ? publishedMatch[1] : "",
      live: /\blive\b/i.test(title) && !/\b(was|recap|replay)\b/i.test(title),
    });
  }
  return entries;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const r = await fetch(FEED_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    const xml = await r.text();
    const videos = parseFeed(xml).slice(0, 8);
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
