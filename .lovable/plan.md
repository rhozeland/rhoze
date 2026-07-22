# /start Redesign + Portfolio Backend

Two connected systems. Phase 1 ships the new front door. Phase 2 gives the team a real backend to feed it.

---

## Phase 1 — New `/start` page (Studio Concierge)

Full rebuild of `src/start/StartPage.tsx` in the direction you picked (warm cream #faf8f5, tan #c9b99a, taupe #8b7355, near-black ink, Inter light). Layout follows the "Modular" wireframe: left column = identity + auth + live dashboard slot, right column = pathways + roster.

**Signed-out state — one screen, three pathways + inline auth**

```
┌──────────────────────┬──────────────────────────────────────────┐
│ STUDIO CONCIERGE     │  01 SUBSCRIBE   02 BUILD    03 REQUEST   │
│ Welcome back.        │  Monthly        Scoped      Rapid brief  │
│                      │  retainer       estimate    (48h)        │
│ ┌─ Access Studio ──┐ │                                          │
│ │ email            │ │  ──────────────────────────────────────  │
│ │ password         │ │  PICK YOUR TEAM        · from portfolio  │
│ │ [ Sign In ]      │ │  [portrait][portrait][portrait][portrait]│
│ │  ── or ──        │ │  Name · role · projects worked           │
│ │ [G] Google       │ │                                          │
│ └──────────────────┘ │  ──────────────────────────────────────  │
│                      │  ACTIVE WORKSPACE (shown when signed in) │
│ (auth swaps to       │  Project · milestone bar · credits left  │
│  compact dashboard   │                                          │
│  when signed in)     │                                          │
└──────────────────────┴──────────────────────────────────────────┘
```

- **Subscribe** → opens tier picker + embedded Stripe checkout (existing flow, restyled).
- **Build** → opens the scoped-services drawer (existing catalog + cart + deposit checkout, restyled to warm tokens).
- **Request** → lightweight brief form → writes to `intake_requests` (existing), routes to team.
- **Auth panel** — email/password + Google, in-page. On success the whole left column swaps to a compact live dashboard (active project, milestone progress, credits, "Open full dashboard →" link into `/client/home` or `/portal/:id`).
- **Pick your team rail** — pulls verified team members from `profiles` + `user_roles` (admin/employee) plus their project counts from Phase 2 credits table. Falls back to empty state until Phase 2 is populated.
- Fully responsive: single column mobile, split on `md+`.

**Not touched in Phase 1:** the /start URL, existing Stripe integration, existing intake table, existing tier/service data. Only the shell and visual system change.

---

## Phase 2 — Portfolio backend in Team Portal

New team-portal section at `/portfolio` (admin/employee edit, everyone reads).

### Schema (migration)

- `public.portfolio_works` — title, slug, client_name, year, summary, tags[], hero_media_url, hero_media_kind (image/video/gif), external_url, published (bool), featured_order (int), created_at/updated_at.
- `public.portfolio_media` — work_id FK, url, kind, caption, sort_order. Multi-media per work (thumbs, gifs, videos, stills).
- `public.portfolio_credits` — work_id FK, user_id FK (profiles), role (e.g. "Director", "Editor"), sort_order. This is the join that answers "who worked on it" and drives the /start roster.
- RLS: read = public for `published=true`; write = admin/employee via `is_team_member`. GRANTs on all three tables per project rules.

### Team-portal UI (`src/team/pages/Portfolio.tsx`)

- List view: table of works with published toggle, featured order, quick filters, search.
- Detail editor: title/client/year/tags, hero media picker (upload to `docs` bucket or paste Drive/YouTube URL — reuses `EmbedPreview`), media grid drag-to-reorder, credits picker (autocomplete team members → assign role).
- "Publish to public site" toggle syncs `published` flag.

### Public `/projects.html` sync

- Replace the current hand-authored project list with a fetch from `portfolio_works` where `published=true`, ordered by `featured_order`. Keeps the static HTML shell; injects rows at runtime via a small script.

### Feeds into `/start`

- The "Pick your team" rail on the new /start page queries `portfolio_credits` grouped by user → shows top N members by project count with their most recent work thumbnail as hover state.
- Selecting a team member on /start stores their id in the intake payload so the assigned team knows who the client wants.

---

## Technical notes (for the dev, not the plan reader)

- Palette tokens added to `src/index.css` as `--concierge-*` HSL vars; component classes use them via Tailwind arbitrary values (`bg-[hsl(var(--concierge-cream))]`) to stay theme-safe.
- Auth uses existing `supabase.auth.signInWithPassword` and `signInWithOAuth({ provider: 'google', redirectTo: window.location.origin + '/start.html' })`.
- Dashboard slot reuses the existing `ClientDashboard` component in a compact variant.
- Portfolio media uploads go to the existing `docs` bucket under a `portfolio/` prefix.

---

## What I need from you before I start

Nothing blocking — the wireframe pick is enough. I'll ship Phase 1 first, show you the working page, and only start Phase 2 after you approve Phase 1. Reply "ship phase 1" (or with any tweaks) and I'll build.
