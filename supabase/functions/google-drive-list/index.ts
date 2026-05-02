import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

function bad(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad(405, "method not allowed");

  // Auth: only team members may browse the shared Drive.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return bad(401, "unauthorized");

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await sb.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) return bad(401, "unauthorized");

  const { data: isTeam } = await sb.rpc("is_team_member", { _user_id: claims.claims.sub });
  if (!isTeam) return bad(403, "team members only");

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!LOVABLE_API_KEY) return bad(500, "LOVABLE_API_KEY not configured");
  if (!GOOGLE_DRIVE_API_KEY) return bad(500, "GOOGLE_DRIVE_API_KEY not configured");

  let body: { folderId?: string; q?: string; pageToken?: string } = {};
  try {
    body = await req.json();
  } catch { /* allow empty body for root listing */ }

  // Build query: scope to a folder, optionally filter by name.
  const parts: string[] = ["trashed = false"];
  const parent = (body.folderId || "root").replace(/[^a-zA-Z0-9_-]/g, "");
  parts.push(`'${parent}' in parents`);
  if (body.q && body.q.trim()) {
    const safe = body.q.trim().replace(/'/g, "\\'").slice(0, 100);
    parts.push(`name contains '${safe}'`);
  }

  const params = new URLSearchParams({
    q: parts.join(" and "),
    fields:
      "nextPageToken, files(id,name,mimeType,iconLink,webViewLink,modifiedTime,size,owners(displayName,emailAddress))",
    pageSize: "100",
    orderBy: "folder,name",
  });
  if (body.pageToken) params.set("pageToken", body.pageToken);

  const res = await fetch(`${GATEWAY_URL}/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_DRIVE_API_KEY,
    },
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("Drive gateway error", res.status, text);
    return bad(res.status, `drive gateway error: ${text.slice(0, 300)}`);
  }

  return new Response(text, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});