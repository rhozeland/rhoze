import { supabase } from "@/integrations/supabase/client";

const GUEST_KEY = "rhoze_copilot_guest_token";
const CONVO_KEY = "rhoze_copilot_conversation_id";

export type BriefState = {
  project_type?: string;
  summary?: string;
  audience?: string;
  deliverables?: string[];
  references?: string[];
  timeline_weeks_low?: number;
  timeline_weeks_high?: number;
  budget_low_cents?: number;
  budget_high_cents?: number;
  recommended_pathway?: "subscribe" | "build" | "request";
  readiness?: number;
};

export type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  transcript_source?: string | null;
  created_at: string;
};

export type Conversation = {
  id: string;
  user_id: string | null;
  guest_token: string | null;
  brief_json: BriefState;
  recommended_pathway: string | null;
  estimate_low_cents: number | null;
  estimate_high_cents: number | null;
  timeline_weeks_low: number | null;
  timeline_weeks_high: number | null;
  status: string;
};

function ensureGuestToken(): string {
  let t = localStorage.getItem(GUEST_KEY);
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem(GUEST_KEY, t);
  }
  return t;
}

export function getGuestToken(): string {
  return ensureGuestToken();
}

export async function getOrCreateConversation(): Promise<Conversation> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id ?? null;
  const guestToken = ensureGuestToken();

  // Try existing convo id from localStorage
  const existing = localStorage.getItem(CONVO_KEY);
  if (existing) {
    const { data } = await supabase
      .from("copilot_conversations")
      .select("*")
      .eq("id", existing)
      .maybeSingle();
    if (data) return data as unknown as Conversation;
  }

  // Search by owner
  const query = supabase
    .from("copilot_conversations")
    .select("*")
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1);
  const { data: found } = userId
    ? await query.eq("user_id", userId)
    : await query.eq("guest_token", guestToken);
  if (found && found[0]) {
    localStorage.setItem(CONVO_KEY, found[0].id);
    return found[0] as unknown as Conversation;
  }

  // Create fresh
  const insertPayload = userId
    ? { user_id: userId, guest_token: guestToken }
    : { user_id: null, guest_token: guestToken };
  const { data: created, error } = await supabase
    .from("copilot_conversations")
    .insert(insertPayload)
    .select("*")
    .single();
  if (error || !created) throw error ?? new Error("Failed to create conversation");
  localStorage.setItem(CONVO_KEY, created.id);
  return created as unknown as Conversation;
}

export async function loadMessages(conversationId: string): Promise<CopilotMessage[]> {
  const { data } = await supabase
    .from("copilot_messages")
    .select("id, role, content, transcript_source, created_at")
    .eq("conversation_id", conversationId)
    .in("role", ["user", "assistant"])
    .order("created_at");
  return (data ?? []) as CopilotMessage[];
}

export async function reloadConversation(conversationId: string): Promise<Conversation | null> {
  const { data } = await supabase
    .from("copilot_conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();
  return (data as unknown as Conversation) ?? null;
}

/**
 * Stream chat SSE from the edge function. onDelta is called for each text delta;
 * resolves when the stream completes.
 */
export async function streamCopilotChat(opts: {
  conversationId: string;
  guestToken: string;
  history: { role: "user" | "assistant"; content: string }[];
  onDelta: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot-chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sess.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      conversation_id: opts.conversationId,
      guest_token: opts.guestToken,
      messages: opts.history,
    }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    let msg = `Copilot error (${res.status})`;
    try { const j = await res.json(); msg = j.error ?? msg; } catch { /* */ }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload);
        const delta = j.choices?.[0]?.delta?.content;
        if (typeof delta === "string") opts.onDelta(delta);
      } catch { /* ignore malformed */ }
    }
  }
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  const form = new FormData();
  form.append("file", blob, blob.type.includes("mp4") ? "recording.mp4" : "recording.webm");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot-transcribe`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sess.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Transcription failed");
  return data.text ?? "";
}

export function stripBriefBlock(text: string): string {
  return text.replace(/```brief[\s\S]*?```/g, "").trim();
}

/** Upload a file attachment to storage; returns { path, signedUrl }. */
export async function uploadAttachment(conversationId: string, file: File): Promise<{ path: string; signedUrl: string; kind: string }> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("copilot-attachments").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  const { data: signed, error: sigErr } = await supabase.storage
    .from("copilot-attachments")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (sigErr || !signed) throw sigErr ?? new Error("Signed URL failed");
  const kind = file.type.startsWith("image/") ? "image"
    : file.type.startsWith("audio/") ? "audio"
    : file.type === "application/pdf" ? "pdf"
    : "file";
  return { path, signedUrl: signed.signedUrl, kind };
}

export async function submitCopilot(opts: {
  conversationId: string;
  guestToken: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
}): Promise<{ intake_id: string }> {
  const { data: sess } = await supabase.auth.getSession();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot-submit`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sess.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      conversation_id: opts.conversationId,
      guest_token: opts.guestToken,
      contact_name: opts.contactName,
      contact_email: opts.contactEmail,
      contact_phone: opts.contactPhone,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Submit failed");
  return data;
}

export function resetConversation() {
  localStorage.removeItem(CONVO_KEY);
}

/**
 * Marks a guest conversation as email-captured so the concierge unlocks.
 * Also seeds the first user message with the form context.
 */
export async function unlockConciergeForGuest(opts: {
  conversationId: string;
  seedMessage: string;
}): Promise<void> {
  await supabase
    .from("copilot_conversations")
    .update({ email_captured_at: new Date().toISOString() })
    .eq("id", opts.conversationId);
  if (opts.seedMessage.trim()) {
    await supabase.from("copilot_messages").insert({
      conversation_id: opts.conversationId,
      role: "user",
      content: opts.seedMessage,
    });
  }
}