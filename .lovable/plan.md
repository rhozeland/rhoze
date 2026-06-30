## Goal

Evolve `/start.html` (currently a static marketing page) into a **hybrid** Start a Project surface: marketing-style tier picker on top for anonymous visitors, signed-in dashboard panel underneath for clients.

## Layout

```text
┌─────────────────────────────────────────────┐
│ HERO  "Start a project"                     │
│ Tagline · sign in CTA (right side)          │
├─────────────────────────────────────────────┤
│ TIERS / À LA CARTE  (always visible)        │
│  - Subscription tiers grid                  │
│  - À la carte sessions + custom deposit     │
│  - "Checkout" button → Stripe               │
├─────────────────────────────────────────────┤
│ ── signed-in only below ──                  │
│ DASHBOARD                                   │
│ ┌─ Credits ──────┐ ┌─ Active project ────┐ │
│ │ 12 credits     │ │ Project: FUS Rollout │ │
│ │ $240 balance   │ │ Status: active       │ │
│ │ [Top up]       │ │ Next: Mix v2 (Aug 4) │ │
│ │ [Change tier]  │ │ [Open portal]        │ │
│ └────────────────┘ └─────────────────────┘ │
│ ┌─ Request work ─────────────────────────┐ │
│ │ Title · description · est. credits     │ │
│ │ [Submit request]                       │ │
│ └────────────────────────────────────────┘ │
│ Recent requests list (status pills)        │
└─────────────────────────────────────────────┘
```

Anonymous user → only sees hero + tiers + "Sign in to see your dashboard" prompt.
Signed-in user → sees everything; if they have no project yet, dashboard shows an onboarding state ("Your project will appear here after your first checkout").

## Implementation

1. **Keep `start.html` as the SPA mount** (`src/start-main.tsx` → `StartPage.tsx`). The page is already React — extend it, don't rewrite to static HTML.
2. **Auth**: reuse the existing community auth client (`rhz-community-auth` storage key) so one sign-in covers leaderboard + start page. Add a top-right "Sign in / Account" button. Use email+password (already wired in `leaderboard.html`).
3. **Dashboard data sources** (all already in DB):
   - `projects` (via `project_clients` join) → title, status, `credit_balance`, `dollar_balance_cents`, `active_tier_slug`
   - `project_milestones` → next deliverable
   - `credit_requests` → list + submission form via existing `credit_request_*` RPCs
   - `service_packages` → top-up + tier change options (already pulled in StartPage)
4. **Top-up flow**: reuse existing `create-checkout` edge function with the user's `project_id`. After Stripe redirect, `apply_project_topup` already credits the balance.
5. **Submit request**: insert into `credit_requests` with `requested_by = auth.uid()`, `project_id = active project`. Existing trigger handles activity log.
6. **No schema changes** — current tables and RPCs cover everything. Only RLS check: confirm `credit_requests` allows the requester to read their own rows (it already does per existing policies).

## Out of scope (next iteration)

- Billing/invoice history view (deferred per your scope choice)
- Stripe customer portal embed (link only for now)
- Multi-project switcher (handle single active project first; add switcher when a client has 2+)

## Notes / decisions to confirm later

- Should the dashboard land on `/start.html` or move to `/dashboard.html`? Defaulting to `/start.html` per your direction.
- Sign-in shares the leaderboard account, so a creator who submits memes and a client who pays both use the same login.
