# Rhozeland ICO — Investor Dashboard + Content-Engine Homepage

## What we're building

A three-part ship that turns rhozeland.com into a login-gated investor & content platform for the $RHOZE graduation push. No online payments — contributions are logged as **pledges**, you settle them via Square POS or on-chain, and mark them fulfilled from an admin console. Investors log in to see their pledge, lock status, $RHOZE credits, and analytics.

---

## Part 1 — Homepage login bar + logged-in content engine

**New thin auth strip under the header** on the marketing site (`index.html` + React homepage):
- Signed out: `Sign in` · `Start a project` · `Invest in $RHOZE`
- Signed in: avatar chip · `$RHOZE balance` · `Dashboard` · `Sign out`

**Content-engine homepage** for signed-in users — same hero, but three dynamic rails appear:
- **Now on the wire** — pulls from `news_ticker_items` + `live_dashboard_content`
- **Latest projects** — pulls from `projects` (public ones)
- **From the studio** — music/video feed (reuses `live-social-feed` edge function)

Signed-out users see the current homepage unchanged.

---

## Part 2 — Investor dashboard (`/invest`)

### Public landing (signed out)
- Hero with **live SOL-to-graduation meter** (progress bar, remaining SOL, USD equiv)
- Tier cards: **Supporter / Builder / Core Cohort** with credit multipliers + lock perks
- Self-Serve vs Assisted comparison
- "Pledge to invest" CTA → forces sign-in, then routes to pledge form
- Whitepaper download link (uses your existing docx)

### Authenticated dashboard (`/invest/dashboard`)
Personal investor console:
- **My pledges**: amount pledged, tier, lock length, status (`pending`, `confirmed`, `settled`, `fulfilled`), fee, credits earned
- **$RHOZE credits balance** (redeemable on merch/services — reuses existing `rhoze_balances` where possible)
- **Lock status** + unlock date
- **Contribution history** with transaction hashes (once entered by admin)
- **Analytics strip**: total raised so far, cohort size, your rank, time-to-graduation ETA
- **New pledge** button → pledge form

### Pledge form
- Amount (USD)
- Tier (auto-selected from amount)
- Lock preference (none / 30d / 90d / 6mo)
- Path: **Self-Serve** (they'll buy themselves) or **Assisted** (Rhozeland executes) → adds 7% service fee shown clearly
- Optional Solana wallet (pulls from their custodial wallet by default)
- Notes / how they want to pay (Square POS, e-transfer, crypto)
- Submit → creates `investor_pledges` row with status `pending`, emails you

### Admin console (`/team/invest` — team-only)
Full ops panel:
- Table of all pledges with filters (status, tier, path)
- Actions: mark `confirmed` (payment received via Square), add tx hash, mark `settled` (SOL sent into curve), mark `fulfilled` (credits issued + locked)
- Live campaign stats: total raised, remaining to graduate, fee revenue, cohort breakdown
- Manual credit issuance (writes to `rhoze_balances` via existing `rhoze_award` RPC)

---

## Part 3 — Backend

### New tables

**`investor_pledges`**
- `user_id` (FK auth.users), `amount_usd_cents`, `tier` (enum: supporter/builder/core), `lock_months` (0/1/3/6), `path` (self_serve/assisted), `service_fee_cents`, `credit_multiplier` (numeric), `payment_method` (square/etransfer/sol/usdc/other), `solana_wallet`, `notes`, `status` (pending/confirmed/settled/fulfilled/cancelled), `tx_signature`, `settled_at`, `fulfilled_at`, `credits_awarded`, `admin_notes`

**`campaign_state`** (single-row config)
- `remaining_sol`, `sol_price_usd`, `campaign_open` (bool), `window_ends_at`, `total_raised_cents`, `updated_by`, `updated_at`
- Admin manually updates `remaining_sol` (or later: cron pulls from Pump.fun). Public read policy.

### RLS
- `investor_pledges`: users SELECT/INSERT their own; team SELECT/UPDATE all; admin DELETE
- `campaign_state`: public SELECT; team UPDATE

### RPCs
- `create_pledge(...)` — validates tier vs amount, computes fee & multiplier, inserts row
- `admin_fulfill_pledge(_pledge_id)` — team-only; issues $RHOZE credits via existing `rhoze_award`, sets `fulfilled_at`

### Edge function
- `notify-new-pledge` — emails admin on new pledge (reuses transactional email infra)

No payment integrations. No Stripe changes. Square is offline; you reconcile manually.

---

## Files touched

**New:**
- `src/invest/InvestPage.tsx` (public landing)
- `src/invest/InvestDashboard.tsx` (authenticated investor view)
- `src/invest/PledgeForm.tsx`
- `src/invest/CampaignMeter.tsx` (shared live progress component)
- `src/team/pages/InvestAdmin.tsx`
- `src/components/AuthStrip.tsx` (thin login bar for homepage)
- `src/components/ContentEngineRails.tsx` (signed-in homepage rails)
- `supabase/functions/notify-new-pledge/index.ts`
- `invest.html` + `src/invest-main.tsx` (multi-page Vite entry, matches your `start.html` pattern)

**Edited:**
- `index.html` — insert AuthStrip mount + content rails placeholder
- `src/pages/Index.tsx` — same on the React side
- `src/team/TeamApp.tsx` — add `/invest` admin route
- `vite.config.ts` — add `invest.html` entry
- Migration for `investor_pledges`, `campaign_state`, RLS, RPCs, GRANTs

---

## Ship order

1. Migration (pledges + campaign_state + RPCs)
2. `/invest` public landing with live meter
3. Pledge form + auth gate
4. Investor dashboard
5. Admin console
6. Homepage AuthStrip
7. Signed-in content rails
8. Notification edge function

## Open questions I'll assume defaults on (say if wrong)

- **Tier thresholds**: Supporter $50–499 (1.0×), Builder $500–1999 (1.15×), Core $2000+ (1.4×). Lock adds bonus multiplier.
- **Assisted fee**: 7% flat, added on top and shown line-item.
- **Campaign meter**: you manually update `remaining_sol` from the admin console for now. Pump.fun API polling can come later.
- **Credit redemption**: reuses your existing `rhoze_redeem_for_credits` — no new redemption UI in this pass.

Approve and I ship it in one pass.
