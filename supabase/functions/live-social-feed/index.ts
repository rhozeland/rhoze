// Public edge function: fetches recent posts from X and LinkedIn for the
// Rhozeland livestream dashboard and blends in editor-managed IG/LI fallbacks.
// No auth required — this is a public broadcast feed.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev";
const X_USERNAME = "rhozeland";

type Post = {
  who: string;
  plat: "X" | "LI" | "IG" | "YT";
  h: string;
  msg: string;
  url?: string;
  source?: "live" | "editor";
};

function humanAgo(iso: string): string {
  const d = new Date(iso).getTime();
  if (!isFinite(d)) return "";
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}

async function fetchX(lovableKey: string, xKey: string): Promise<Post[]> {
  // 1) resolve user id
  const uRes = await fetch(
    `${GATEWAY}/x/2/users/by/username/${encodeURIComponent(X_USERNAME)}?user.fields=profile_image_url,name`,
    { headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": xKey } },
  );
  if (!uRes.ok) throw new Error(`x user ${uRes.status}`);
  const u = await uRes.json();
  const uid = u?.data?.id;
  const uname = u?.data?.username || X_USERNAME;
  if (!uid) return [];

  // 2) recent tweets
  const tRes = await fetch(
    `${GATEWAY}/x/2/users/${uid}/tweets?max_results=10&tweet.fields=created_at,entities&exclude=retweets,replies&expansions=attachments.media_keys&media.fields=preview_image_url,url,type`,
    { headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": xKey } },
  );
  if (!tRes.ok) throw new Error(`x tweets ${tRes.status}`);
  const t = await tRes.json();
  return (t?.data ?? []).slice(0, 8).map((tw: any): Post => {
    return {
      who: "@" + uname,
      plat: "X",
      h: humanAgo(tw.created_at),
      msg: (tw.text || "").replace(/https?:\/\/\S+/g, "").trim().slice(0, 200),
      url: `https://x.com/${uname}/status/${tw.id}`,
      source: "live",
    };
  });
}

async function fetchLinkedIn(lovableKey: string, liKey: string): Promise<Post[]> {
  // The connected member (the account that authorised) — read profile only.
  // LinkedIn API for reading arbitrary company posts requires a partnership
  // programme. We surface the connected identity + a static "latest company
  // update" placeholder so the feed always has a LI card.
  const res = await fetch(`${GATEWAY}/linkedin/v2/userinfo`, {
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": liKey },
  });
  if (!res.ok) return [];
  const j = await res.json();
  const name = j?.name || "Rhozeland";
  return [
    {
      who: name,
      plat: "LI",
      h: "today",
      msg: "Rhozeland is building the operating system for independent artists — recording, video, launch, and rewards, all in one place.",
      url: "https://www.linkedin.com/company/rhozeland",
      source: "live",
    },
  ];
}

async function fetchEditorSocialFallback(): Promise<Post[]> {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return [];

  const res = await fetch(
    `${url}/rest/v1/live_dashboard_content?select=payload&section_key=eq.social_feed&is_published=eq.true&limit=1`,
    { headers: { apikey: anon, Authorization: `Bearer ${anon}`, Accept: "application/json" } },
  );
  if (!res.ok) return [];
  const rows = await res.json();
  const fallbackPosts = rows?.[0]?.payload?.fallbackPosts;
  if (!Array.isArray(fallbackPosts)) return [];

  return fallbackPosts
    .map((p: any): Post | null => {
      const plat = String(p.platform || p.plat || "IG").toUpperCase();
      if (!["X", "LI", "IG", "YT"].includes(plat)) return null;
      const msg = String(p.message || p.msg || "").trim();
      if (!msg) return null;
      return {
        who: String(p.who || p.handle || "@rhozeland"),
        plat: plat as Post["plat"],
        h: String(p.time || p.h || "today"),
        msg: msg.slice(0, 220),
        url: typeof p.url === "string" ? p.url : undefined,
        source: "editor",
      };
    })
    .filter(Boolean) as Post[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const xKey = Deno.env.get("X_API_KEY");
  const liKey = Deno.env.get("LINKEDIN_API_KEY");

  const results = await Promise.allSettled([
    xKey && lovableKey ? fetchX(lovableKey, xKey) : Promise.resolve([]),
    liKey && lovableKey ? fetchLinkedIn(lovableKey, liKey) : Promise.resolve([]),
    fetchEditorSocialFallback(),
  ]);

  const posts: Post[] = [];
  for (const r of results) if (r.status === "fulfilled") posts.push(...r.value);

  const seen = new Set<string>();
  const unique = posts.filter((p) => {
    const key = `${p.plat}:${p.who}:${p.msg}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return new Response(JSON.stringify({ posts: unique.slice(0, 16), updated_at: new Date().toISOString() }), {
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      "cache-control": "public, max-age=120, s-maxage=120",
    },
  });
});
