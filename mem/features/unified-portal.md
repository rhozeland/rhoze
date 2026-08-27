---
name: Unified portal
description: Single smart-router page at /portal, /login, /client (`src/team/pages/Portal.tsx`) replacing the old PortalLanding, TeamLogin, and ClientAccess cards
type: feature
---
One auth page handles client + team. After auth, the smart router reads `user_roles`:
- admin/employee → `/`
- client with pending project code (URL `?code=` or `localStorage.pending_project_code`) → redeem via `redeem_project_code` then `/portal/:id`
- otherwise → `/client/home`

Project code and team referral code fields are collapsible toggles, not always-on. Old PortalLanding/TeamLogin/ClientAccess files have been deleted; do not re-create them.
Staff entry point: the public homepage keeps its existing HUD and CREATE / BUILD / INVEST nav untouched. A fourth `Team` tab (`#rTeamTab`, plus `#rTeamMenuItem` in the mobile menu) is revealed only when `user_roles` contains admin or employee, and it opens `/team.html` inside the existing inline section viewer — never a new tab. Do not add "open full portal" style external links to the client dashboard.
