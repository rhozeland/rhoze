## Phase 1 — Portal: one-page smart router

Replace the current `/portal` two-card landing with a single sign-in surface that auto-routes by role after auth.

- One page at `/portal` (and `/client` and `/login` redirect into it). Single email + password form, with "Sign in with Google" and a `Have a project code?` toggle that reveals an optional code field.
- On submit / on auth state change: read `user_roles`. If `admin` or `employee` → push to `/` (team dashboard). Else → push to `/client/home`. If a project code was entered, redeem it first via the existing `redeem_project_code` RPC, then route.
- New users get a single "Create account" toggle on the same page (email + password). No separate client vs team signup — team accounts are still invite-only via existing `team_invites` flow, but the form itself is unified.
- Visually match the rest of the site (Inter, the editorial dark/light tokens already in `index.css`) instead of the current generic shadcn card look. Compact, single column, full-height.
- Old routes (`/portal`, `/client`, `/login`) all resolve to the same component so existing links keep working.

## Phase 2 — Public leaderboard + team admin editor

Two surfaces backed by the same Lovable Cloud tables.

**Public side** — new static-feeling page at `/leaderboard` (added to `public/` as a real HTML page to match the editorial site, with a small inline script that fetches from the database via the public anon key).

- Hero with the current week's challenge theme + multiplier + countdown to next snapshot.
- Top-10 leaderboard table: rank, @username, points, challenges completed, last updated.
- Activity breakdown chips per user (raids / memes / threads / videos) using your XLSX columns.
- Points-rules section + 4-week rotating challenge calendar pulled from DB.
- Auto-refreshes every 60s for the "real-time" feel.

**Team editor** — new `/leaderboard` page inside the team dashboard (in `src/team/pages`), gated to `admin` + a new `marketing` role.

- Add/edit/remove leaderboard entries (username, points, per-activity counts).
- Edit weekly challenge (theme, multiplier, dates, description).
- "Publish snapshot" button that timestamps `last_updated` for all rows so the public page reflects a weekly cadence.
- Read-only "Points Rules" reference panel.

**Schema** (3 new tables, all with the standard GRANT + RLS pattern, anon SELECT only on leaderboard rows that have been published):

```text
community_leaderboard
  id, username, points, raids, memes, edu_threads, videos,
  challenges_completed, last_updated, published_at

community_challenges
  id, week_label, theme, description, multiplier, start_date, end_date

community_points_rules
  id, activity, base_points, notes
```

Seed all three tables from your uploaded `rhoze_community_tracker (1).xlsx` in the same migration. Add `marketing` to the `app_role` enum so you can grant edit access without making someone full admin.

## Phase 3 — Brand architecture (decision needed before building)

Three viable paths. Quick tradeoff so you can choose without me guessing:

1. **One Rhozeland, two pillars (recommended).** Keep the current homepage. Below the hero, add two large equal-weight panels: **Rhozeland Media** (artists, podcast, vlogs, livestreams, brand partners, services) and **Rhozeland Tech** (app, $Rhoze, Web3, leaderboard). Each panel deep-links to its own subpage. Pros: preserves the compact editorial feel you like, one URL, fastest to ship. Cons: less dramatic separation.

2. **Media-first homepage + `/tech` subhub.** The homepage becomes a real media front page — latest drops ticker, podcast hero, partner logos ticker, services strip, "work with us" CTA. Tokenomics / chart / wallet status all move behind a `/tech` route linked from the nav. Pros: positions Rhozeland publicly as a media house (your MTV/New Yorker framing). Cons: existing Web3 audience loses the front-door token surface.

3. **Top-level toggle (Media | Tech).** A persistent nav pill that swaps the whole homepage experience. Pros: cleanest mental model, strongest brand statement. Cons: most work, most duplication, splits SEO.

I'll ask you to pick one right after Phase 2 ships so we have your reaction to the live leaderboard before reshaping the front page around it.

### Cross-cutting

- All three phases use Lovable Cloud (no new external services).
- `app_role` enum gets `marketing` added; existing `RequireTeam` keeps working unchanged.
- Nothing on the static editorial pages (`public/*.html`) changes in Phase 1 or 2 except adding `public/leaderboard.html`.

## Sequencing

1. Phase 1 (portal) — single PR, frontend only.
2. Phase 2 (leaderboard) — migration + seed + public page + team editor.
3. Phase 3 (brand) — only after you pick option 1 / 2 / 3.
