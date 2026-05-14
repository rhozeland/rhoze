import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden — admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const targetId = String(body.user_id ?? "").trim();
    if (!targetId) return json({ error: "user_id required" }, 400);
    if (targetId === userData.user.id) return json({ error: "You cannot delete your own account" }, 400);

    // Best-effort cleanup of related rows that lack FK cascades.
    const tables = [
      "user_roles",
      "project_clients",
      "project_allocations",
      "doc_completions",
      "profile_employment_history",
      "team_availability",
      "team_invites",
      "pay_stubs",
    ];
    for (const t of tables) {
      await admin.from(t).delete().eq("user_id", targetId);
    }
    await admin.from("profiles").delete().eq("id", targetId);

    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}