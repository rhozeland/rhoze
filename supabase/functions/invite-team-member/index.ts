import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Role = "admin" | "employee" | "client";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    // Verify caller is an admin
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
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = (body.role ?? "employee") as Role;
    const displayName = body.display_name ? String(body.display_name) : undefined;
    const note = body.note ? String(body.note) : undefined;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Valid email required" }, 400);
    if (!["admin", "employee", "client"].includes(role)) return json({ error: "Invalid role" }, 400);

    // Find or create the auth user
    let userId: string | undefined;
    let tempPassword: string | undefined;
    let createdNew = false;

    // Try invite via email link (user gets a magic link to set their own password)
    const redirectTo = `${new URL(req.url).origin.replace(/\/functions\/v1.*/, "")}`;
    const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: displayName ?? email.split("@")[0] },
      redirectTo: body.redirect_to ?? undefined,
    });

    if (invErr) {
      // If user already exists, fetch them
      if (/already/i.test(invErr.message) || /registered/i.test(invErr.message)) {
        const { data: list } = await admin.auth.admin.listUsers();
        const existing = list?.users.find((u) => u.email?.toLowerCase() === email);
        if (!existing) return json({ error: invErr.message }, 400);
        userId = existing.id;
      } else {
        // Fallback: create user with temp password (in case SMTP isn't configured)
        tempPassword = generatePassword();
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { display_name: displayName ?? email.split("@")[0] },
        });
        if (createErr) return json({ error: createErr.message }, 400);
        userId = created.user?.id;
        createdNew = true;
      }
    } else {
      userId = invited.user?.id;
      createdNew = true;
    }

    if (!userId) return json({ error: "Failed to create or locate user" }, 500);

    // Assign role (idempotent)
    const { error: roleErr } = await admin
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (roleErr && !/duplicate/i.test(roleErr.message)) {
      return json({ error: `Role assignment failed: ${roleErr.message}` }, 500);
    }

    // Record invite
    await admin.from("team_invites").insert({
      email,
      role,
      status: "pending",
      invited_by: userData.user.id,
      user_id: userId,
      note,
    });

    return json({
      ok: true,
      user_id: userId,
      created_new: createdNew,
      temp_password: tempPassword,
      message: tempPassword
        ? "User created. Share the temp password securely — they should change it on first login."
        : "Invite email sent.",
    });
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

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}