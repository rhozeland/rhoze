---
name: Community leaderboard
description: Public /leaderboard.html page + team editor at /leaderboard, backed by community_leaderboard / community_challenges / community_points_rules tables
type: feature
---
Public page `public/leaderboard.html` fetches `community_leaderboard`, `community_challenges`, and `community_points_rules` via the Supabase REST anon key and refreshes every 60s. Only rows with `published_at IS NOT NULL` are visible to anon.

Team editor at `/leaderboard` (`src/team/pages/Leaderboard.tsx`) is gated to `admin` and the new `marketing` role via `public.can_edit_community(uid)`. "Publish snapshot" stamps `published_at = now()` on every row.

The `app_role` enum now includes `marketing`. Grant it from the team-admin role manager when onboarding a marketing person.