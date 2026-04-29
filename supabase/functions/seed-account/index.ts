import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// One-shot bootstrap to create the founding admin account.
// Protected by SEED_SECRET env var so it can't be abused publicly.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SEED_SECRET = Deno.env.get("SEED_SECRET");
    const provided = req.headers.get("x-seed-secret");
    if (!SEED_SECRET || provided !== SEED_SECRET) {
      return json({ error: "Forbidden" }, 403);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = (body.role ?? "admin") as "admin" | "employee" | "client";
    const display_name = body.display_name ? String(body.display_name) : email.split("@")[0];

    if (!email || !password) return json({ error: "email and password required" }, 400);

    // Look for existing user
    const { data: list } = await admin.auth.admin.listUsers();
    let userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;

    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name },
      });
      if (error) return json({ error: error.message }, 400);
      userId = created.user?.id!;
    } else {
      // Update password for existing user
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    }

    // Assign role (idempotent)
    await admin.from("user_roles").upsert(
      { user_id: userId, role },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );

    return json({ ok: true, user_id: userId });
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