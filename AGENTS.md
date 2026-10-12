- Keep the public talent marketplace in `creator_directory`, separate from private account `profiles`, because visitors must never gain access to payroll or account details through discovery.
- Store project likes and liked-list preferences separately with database-enforced owner writes and public visibility checks, because list privacy must hold beyond the browser.
- Route Discover/home cards to local records; use project-view.js for other pop-ups, preserving source and owner checks.
- Mirror community.html and community/index.html; link to /community.html, because clean and direct URLs must match.

- Share public navigation through site-nav.css, shared.js and SiteNav, including account controls. Wrap standalone portal pages in PortalShell; embedded portals inherit the parent header to prevent duplication.
- Share frame geometry via site-nav.css and embed markers via shared.js/SiteNav; keep one Create header destination for compact navigation.
- Mirror the story at public/about.html and public/about/index.html with story.css and shared footer links, preserving public navigation.
- Derive brand identity from a slug of each release's creator name (matching `rz_slugify` in SQL and `slugify` in JS), with optional details in `brand_profiles`, because releases have no brand table and both sides must agree on URLs.
- Route profile edits through owner-checked database functions rather than direct table updates, so owners can never change approval, rating, or tier fields.
- Decide release ownership by the signed-in account (`releases.user_id`) through owner-checked database functions; the browser token only covers signed-out drafts until `release_claim` attaches them at sign-in, so owners can manage projects from any device.
- Route profile messaging through the `dm_open` database function, which resolves the profile owner server-side and sends unclaimed profiles to the team inbox, so visitors never pick a recipient account directly.
- Keep the three-tab Messages inbox in a dedicated module and read applications through a caller-scoped function with authenticated submission identity, because applications must never be attributed by display name or exposed to unrelated accounts.
- Mark explicitly initiated conversations server-side in `dm_threads.personal_started`, because application-only threads must not appear as personal chats until a participant starts a conversation.
- Portal inbox dialogs into the page's active React mount, because release-mode hides other direct children of the document body.
- Use only public cover artwork for locked Exclusive preview cards; keep post text and private media behind existing owner/wallet checks so visual teasers never expose protected content.
- Store per-project workspace choices (makers, timeline, public section switches) inside the release `answers` JSON saved via `release_save`, because the owner-checked save path already protects them and no schema change is needed.
- Follow `src/create/AGENTS.md` for cover cropping, market data, wizard compatibility, and globe rules.
- Award public-account $RHOZE rewards only through database triggers into `user_rewards_ledger` (unique per user/kind/reference, amounts in `rz_reward_amount`), because clients must never mint rewards and repeated actions must not farm them.
- Keep the fixed-slide presentation in its own Vite entry, so navigation/print never alter the website.
- Resolve deck screenshots to the published host on localhost only; Vite lacks the asset CDN.

- Create releases as private workspaces through release_save; publish only through a separate confirmed owner action, because planning must not expose projects automatically.
- Keep collaborator email shortlists in owner-only release_team_members, never release answers, because published answers are publicly readable.
- Build Discover as a Vite entry mirrored to static URLs; resolve only unique public account-backed creators, preserve source links, and keep globe/Flow public-only to prevent invented ownership.
- Use /workspace/:id for account-owned private release management and owner-scoped my_releases for reads, because private projects have no public slug requirement.

- Derive XP from verified earnings; list approved public account-backed newcomers at zero and keep historical community points separate, because handles cannot prove account ownership or token balances.
- Adapt Creator OS with CSS tilt only; preserve permission and reward rules.

- Read discussion through published-project-only functions with server-resolved public authors and owner writes, because private accounts must stay hidden. Comments award no rewards to avoid farming.
- Keep home-motion.js fed by Discover registries; portfolio-projects preserves sources and admin-write portfolio_details stores lore/tokens, never inferred ownership.
- Scope toolbar styles in discover-toolbar.css, mirrored on both Discover pages, to preserve shared navigation.

- Use owner-only project_bookmarks and Creator OS Flow navigation over public registries; never reward views/bookmarks to prevent farming.
