# /start Rebuild — Concierge v2

Locked-in decisions from your reply:
- **Wallet:** custodial-by-default, editable in Settings.
- **Concierge:** hybrid — form first (free), then unlock 5 AI turns after email capture.
- **Signed-in /start:** show the full embedded ClientDashboard above the pathways.
- **Subscribe:** kill the modal, inline branded section with credit-value framing.

## 1. Custodial Solana wallet (backend)

New table `user_wallets`:
- `user_id` (unique, FK → auth.users)
- `pubkey` (base58)
- `secret_encrypted` (bytea, encrypted with `WALLET_ENCRYPTION_KEY`)
- `is_custodial` (bool, default true)
- `created_at`, `updated_at`

RLS: user can SELECT their own row (pubkey only via a view); no client-side UPDATE/INSERT.
- Public view `user_wallet_pubkeys` exposing only `user_id`, `pubkey`, `is_custodial` — safe for the client.
- Edge function `wallet-provision` (auto-runs on first /start load when signed in): generates a Solana keypair with `@solana/web3.js`, encrypts secret with AES-GCM using `WALLET_ENCRYPTION_KEY`, upserts row.
- Edge function `wallet-replace-external`: user pastes their own pubkey → sets `is_custodial=false`, wipes stored secret.
- Add `WALLET_ENCRYPTION_KEY` via `generate_secret` (64 chars).

Settings page gains a "Wallet" card: shows current pubkey, "Copy", "Replace with my own wallet" (external paste flow), "Reveal recovery phrase" (deferred — placeholder button noting "Coming soon: export").

## 2. Hybrid concierge

`/start` (signed-out) starts as a **structured form**: project type (chip picker), timeline, budget range, one-line description, email. No AI cost until email captured.

On submit:
- Creates `intake_requests` row + a `copilot_conversations` row seeded with the form as the first system+user turn.
- Unlocks "Refine with Concierge" panel with a 5-turn budget (tracked in `copilot_conversations.turn_budget` / `turns_used`).
- Voice + attachments remain available inside the refinement panel.

When budget hits 0 → CTA: "Send to team" or "Sign in for unlimited refinement."

## 3. Signed-in /start = embedded dashboard

If session exists:
- Render `<ClientDashboard />` full-width at top (projects, roadmap, credits, $RHOZE, active subscription summary).
- Below it: compact "Start something new" strip with two buttons — "New project brief" (opens concierge inline) and "Manage subscription" (scrolls to inline subscribe section).
- Loyalty rail moves into the dashboard header (already has one; deduplicate).

## 4. Inline branded Subscribe section

Delete `SubscribeDialog`. Add `<SubscribeSection />` rendered inline on /start:
- Uses brand palette from `index.css` (`--ink`, `--paper`, `--accent`, warm cream/tan).
- 3 tier cards side-by-side with:
  - Tier name + monthly price
  - **Credits/mo big number** + "≈ $X value" framing
  - $RHOZE yield per dollar
  - Feature bullets
  - "Choose {tier}" → mounts `<StripeEmbeddedCheckout />` inline below (not modal)
- Signed-out users: button prompts inline auth first, then checkout mounts.

## 5. Files touched

- **Migrations:** `user_wallets` table + RLS + `user_wallet_pubkeys` view; `copilot_conversations.turn_budget`, `turns_used` columns.
- **Edge functions:** `wallet-provision`, `wallet-replace-external`.
- **New:** `src/start/WalletSlot.tsx`, `src/start/SubscribeSection.tsx`, `src/start/ConciergeForm.tsx`.
- **Rewrite:** `src/start/StartPage.tsx` (split signed-in vs signed-out branches).
- **Edit:** `src/team/pages/Settings.tsx` — add Wallet card.
- **Edit:** `supabase/functions/copilot-chat/index.ts` — enforce turn budget.

## Technical notes

- Encryption: AES-256-GCM via `crypto.subtle` in the edge function; store `iv || ciphertext || tag` in `secret_encrypted`. Key kept only in env.
- Keypair generation uses `npm:@solana/web3.js` inside Deno.
- Turn budget check happens server-side in `copilot-chat` before calling the model — client display is informational only.
- Custodial-by-default = we hold the key. That's a real custody obligation. This first pass is fine for **display + $RHOZE ledger accrual**; do NOT wire outbound transfers until we add a proper key management review. I'll mark the wallet as "display balance only, transfers coming soon" in the UI so we don't overpromise.

Approve and I ship it in one pass.
