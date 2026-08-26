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
  const guestToken = ensureGuestToken();
  const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

  // Try existing convo id from localStorage (token/ownership verified server-side)
  const existing = localStorage.getItem(CONVO_KEY);
  if (existing) {
    const { data } = await rpc("copilot_get_conversation", {
      p_id: existing,
      p_guest_token: guestToken,
    });
    const row = Array.isArray(data) ? data[0] : null;
    if (row) return row as Conversation;
  }

  // Search by owner (auth user or matching guest token)
  const { data: found } = await rpc("copilot_find_draft", { p_guest_token: guestToken });
  const draft = Array.isArray(found) ? found[0] : null;
  if (draft) {
    localStorage.setItem(CONVO_KEY, (draft as Conversation).id);
    return draft as Conversation;
  }

  // Create fresh
  const { data: created, error } = await rpc("copilot_create_conversation", {
    p_guest_token: guestToken,
  });
  const row = Array.isArray(created) ? created[0] : null;
  if (error || !row) throw (error as Error) ?? new Error("Failed to create conversation");
  localStorage.setItem(CONVO_KEY, (row as Conversation).id);
  return row as Conversation;
}

export async function loadMessages(conversationId: string): Promise<CopilotMessage[]> {
  const { data } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>)(
    "copilot_list_messages",
    { p_conversation_id: conversationId, p_guest_token: ensureGuestToken() }
  );
  return (Array.isArray(data) ? data : []) as CopilotMessage[];
}

export async function reloadConversation(conversationId: string): Promise<Conversation | null> {
  const { data } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>)(
    "copilot_get_conversation",
    { p_id: conversationId, p_guest_token: ensureGuestToken() }
  );
  const row = Array.isArray(data) ? data[0] : null;
  return (row as Conversation) ?? null;
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
  const path = `${conversationId}/${ensureGuestToken()}/${crypto.randomUUID()}.${ext}`;
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
  const { error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>)(
    "copilot_capture_email",
    {
      p_conversation_id: opts.conversationId,
      p_guest_token: ensureGuestToken(),
      p_seed: opts.seedMessage,
    }
  );
  if (error) throw error as Error;
}