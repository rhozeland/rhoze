
# /start Redesign — Studio Copilot

Replace Phase 1's modular layout with a **conversational AI copilot** as the primary experience. Team roster stays, but demoted to a small inline suggestion after the copilot understands the project.

---

## The experience

```
┌────────────────────────────────────────────────────────────┐
│  STUDIO CONCIERGE          (auth: Sign in · optional)      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   ┌─ Copilot thread ───────────────┐  ┌─ Live brief ────┐  │
│   │ AI: Hey — tell me about your   │  │ Type: —         │  │
│   │     project. Timeline, vibe,   │  │ Scope: —        │  │
│   │     references, anything.      │  │ Budget: —       │  │
│   │                                │  │ Timeline: —     │  │
│   │ You: [text / 🎙 voice / 📎]    │  │ Est: $—         │  │
│   │ AI: Got it. Two questions...   │  │                 │  │
│   │                                │  │ Path: Build ▸   │  │
│   │ [composer]                     │  │ Suggested team: │  │
│   │ [🎙 hold to talk] [📎] [Send]  │  │ • Marvin · Dir  │  │
│   └────────────────────────────────┘  │ • Michael · Ed  │  │
│                                       │                 │  │
│                                       │ [ Continue → ]  │  │
│                                       └─────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**Copilot behavior:**
- Streams in an assistant persona ("Rhoze Concierge") over Lovable AI (`openai/gpt-5.5`).
- Runs a scoping loop: what → who it's for → deliverables → timeline → budget → references.
- After every user turn, silently updates a **structured brief** (JSON) via a tool call.
- The right rail shows that brief live — fields fill in as the conversation progresses.
- Recommends one of three pathways when it has enough info: **Subscribe** (monthly), **Build** (scoped), or **Request** (48h brief).
- Live estimate: rough $ + weeks, based on scope tags. Updates as brief updates.

**Inputs:**
- Text.
- **Voice notes:** hold-to-talk mic → records webm → `openai/gpt-4o-transcribe` → inserted as user turn with 🎙 badge.
- **Attachments:** images, PDFs, audio — uploaded to `copilot-attachments` bucket, rendered inline, referenced in the brief.
- **Links:** Drive / Figma / YouTube / Loom pasted → parsed with existing `EmbedPreview`.

**Auth: optional, guest-friendly.**
- Whole conversation works signed out. Session persists in `localStorage` by `conversation_id`.
- "Continue →" prompts sign-in only at the moment of committing: opening Stripe checkout, sending the brief to the team, or saving the thread to their account.
- Signed-in users: thread + brief sync to DB, dashboard slot appears above the copilot showing their active project.

**Team suggestions (demoted):**
- Small "Suggested for you" chip strip inside the Live Brief card — 2-3 avatars max, appears only after the copilot classifies the project type.
- No big roster grid on the page.

---

## Backend

New tables:
- `copilot_conversations` — id, user_id (nullable for guests), guest_token, brief_json, recommended_pathway, estimate_low/high, timeline_weeks, status, timestamps.
- `copilot_messages` — conversation_id, role (user/assistant/system), content, attachments_json, transcript_source (text/voice), created_at.
- `copilot_attachments` — conversation_id, message_id, path, kind, mime, size.

Storage bucket: `copilot-attachments` (private, signed URLs).

Edge functions:
- `copilot-chat` — streams AI SDK reply, calls `update_brief` tool to mutate `brief_json`, saves message on `onFinish`. Guest-safe (accepts `guest_token`).
- `copilot-transcribe` — accepts audio blob, forwards to `openai/gpt-4o-transcribe`, returns text.
- `copilot-submit` — final commit: creates `intake_requests` row from `brief_json`, links attachments, routes by pathway.

RLS: owner (user_id or guest_token match) reads/writes their conversation; team reads submitted ones.

---

## Files

- **New:** `src/start/CopilotChat.tsx`, `src/start/CopilotBrief.tsx`, `src/start/CopilotVoiceButton.tsx`, `src/start/copilotClient.ts` (guest token + fetch).
- **Rewritten:** `src/start/StartPage.tsx` — copilot-first layout, auth becomes an inline "Sign in" link in the header.
- **New edge functions:** `supabase/functions/copilot-chat`, `copilot-transcribe`, `copilot-submit`.
- **Migration:** three tables + bucket + RLS + GRANTs.
- **Untouched:** existing Stripe flows, `intake_requests` schema, team portal.

---

## Phase 2 (unchanged, deferred)

Portfolio backend in team portal — feeds the "Suggested team" chips later. Skipped for now per your note that team-pick is nice-to-have.

---

Reply **"ship it"** to build, or tell me what to change (persona tone, which fields the brief tracks, whether voice should be tap-to-record vs hold-to-talk, etc.).
