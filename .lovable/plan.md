# Rhozeland — Major Site Expansion Plan

## ✅ Phase 0 — Navbar Copy (Shipped)
- Replaced "Create" CTA with "Join Community" across React Navbar + all static HTML headers/footers.

---

## 📋 Phase 1 — Employee Portal + CRM (planned)

**Goal**: Internal-only area for Rhozeland team. Footer-only entrance.

**Stack**: Lovable Cloud (Postgres, Auth, RLS, Edge Functions).

### Architecture
- Auth: email/password + Google. Roles stored in dedicated `user_roles` table (admin / employee). Never on profiles.
- `has_role()` security-definer function for RLS.
- Footer entrance: small "Team Access" link → `/team/login` (unindexed).
- Authenticated layout at `/team/*` gated by role check.

### Modules (MVP)
1. **Dashboard** — quick stats, announcements feed.
2. **Payroll** — read-only view of pay periods + downloadable stubs (admin uploads).
3. **Docs & Training** — categorized library (Markdown/PDF), search, completion tracking.
4. **Internal Messaging** — channel-based or 1:1 (Realtime).
5. **CRM**:
   - Contacts (leads, clients, partners)
   - Deals/pipeline (Kanban: Lead → Qualified → Proposal → Won/Lost)
   - Activities log (calls, emails, notes)
   - Marketing: campaign list, email templates, subscriber lists

### Suggested footer copy
- "Team Access" or "Staff Login" — unobtrusive, in footer right column.

---

## 📋 Phase 2 — Start a Project + Subscription Tiers (planned, awaiting docs)

**Goal**: Move "Start a Project" out of contact page into its own flow with two paths.

### Path A — One-off project intake
- Dedicated page: `/start`
- Service selector (audio mix/master, visual, design, web, etc.)
- Scope/budget/timeline form → email + CRM lead.

### Path B — Subscription (PRIMARY)
- Monthly tiers, each grants a credit allowance.
- Credits redeemable against service catalog (variable cost per service).
- **Awaiting**: user-provided documentation describing tier structure, credit costs, and improvisation rules.

### Stack
- Stripe (Lovable built-in payments) — subscriptions + customer portal.
- Cloud DB tables: `subscription_tiers`, `user_subscriptions`, `credit_balance`, `credit_transactions`, `service_catalog`, `service_orders`.
- Client dashboard: balance, history, redeem credits, manage subscription.

### Pending decisions
- Tier names + prices + credit allotments (from user docs)
- Credit cost per service (from user docs)
- Rollover policy, expiry, top-up packs
