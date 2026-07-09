## Two things to ship

### 1. Fix the visual bug (news ticker overlap)

**Where:** the "News" label with the green dot on the far left of the ticker in the homepage masthead (in `index.html`, `.r-eco-tick` + `.r-eco-tick.is-news`).

**Why it clips:** the scrolling track is `overflow:hidden` on its own cell, but the parent row lets the animated text bleed under the stationary "News" label because that label has no background/z-index, and there's no left fade to mask the edge.

**Fix:**
- Give the "News" label cell a solid `background: hsl(var(--surface-card))`, `position: relative`, `z-index: 2`, and a proper right border so it sits above the scrolling row.
- Add a small left fade gradient inside `.r-eco-tick.is-news` (matching the existing behavior on other tickers on the site) so items dissolve into the label cleanly instead of butting up against it.
- Bump the left padding on the first news item so nothing ever kisses the label edge.

### 2. Team Portal → Newsroom (admin for the ticker)

**New page:** `Newsroom` under the team portal (`/newsroom`), added to the sidebar next to `Live Editor`. Admin-only.

**What it does:** lets you edit the homepage news ticker items — the little press/announcement chips that scroll across the masthead. Each row is a simple, typeable entry:

| Field | Notes |
|---|---|
| Label (kicker) | Free text — `New Release`, `Podcast`, `Exhibition`, `Hackathon`, `Community`, whatever you want. Not a fixed dropdown. |
| Headline | The line that scrolls (`Cozal — "Sefra" music video out now`). |
| Link (optional) | Full URL or an internal path like `/leaderboard.html`. If empty, item is not clickable. |
| Sort order | Drag to reorder. |
| Active | Toggle to show/hide without deleting. |

Standard actions: add, edit, reorder, hide/show, delete. Live preview strip at the top of the page shows exactly how the ticker will look on the homepage.

### How the homepage picks up the changes

The static `index.html` masthead ticker gets a small script that fetches the active items from the backend on load and rerenders `#rEcoNewsTrack`. If the fetch fails or returns empty, it keeps the hardcoded fallback items already in the HTML so the ticker is never blank.

### Data & access

- New table `news_ticker_items` in Lovable Cloud with the fields above.
- Public read access (so the homepage can render it without auth).
- Write access restricted to `admin` role via the existing `has_role` pattern.

### Out of scope for this pass

- Rich text / images inside ticker items — kept as plain text on purpose.
- Scheduling (auto publish/unpublish by date). Easy to add later; for now the Active toggle covers it.
- Sharing this ticker with other pages (contact, events, etc.). Same data source could power them later, but not part of this change.

### Technical notes

- Files touched: `index.html` (CSS + fetch script), new `src/team/pages/Newsroom.tsx`, `src/team/TeamApp.tsx` (route), `src/team/components/TeamLayout.tsx` (nav link), one Cloud migration.
- No changes to the React homepage components — the ticker in question lives entirely in `index.html`.
