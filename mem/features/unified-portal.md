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