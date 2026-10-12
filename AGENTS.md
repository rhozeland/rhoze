- Keep the public talent marketplace in `creator_directory`, separate from private account `profiles`, because visitors must never gain access to payroll or account details through discovery.
- Store project likes and liked-list preferences separately with database-enforced owner writes and public visibility checks, because list privacy must hold beyond the browser.
- Mount project pop-ups through project-view.js from shared.js and SiteNav using the same-origin release view, because browsing must preserve its source and owner checks.
- Mirror community.html and community/index.html; link to /community.html, because clean and direct URLs must match.

- Share public links and styles through site-nav.css, shared.js and SiteNav, because headers must match.
- Mount static public account controls through `shared.js`, including the homepage, and mirror their behavior in `SiteNav` so account layouts and session visibility cannot diverge.
- Keep frame geometry in site-nav.css and embedded markers in shared.js/SiteNav, because pages share one frame.
- Keep Create as one header destination in shared.js and SiteNav, without a floating duplicate, because navigation must stay compact.
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
- Keep the submission presentation in a separate Vite entry with one fixed-resolution slide registry and scaling component, because deck navigation and print export must never change the public website.
- Resolve presentation screenshot pointers against the published asset host only on localhost, because Vite does not serve the asset CDN while hosted deployments use same-origin assets.

- Create releases as private workspaces through release_save; publish only through a separate confirmed owner action, because planning must not expose projects automatically.
- Keep collaborator email shortlists in owner-only release_team_members, never release answers, because published answers are publicly readable.
- Discover is the static Featured Projects page mirrored in `public/discover.html` and `public/discover/index.html`; it prepends published releases (pop-up) and keeps legacy cards on real external links, so old work gets no invented owners.
- Use /workspace/:id for account-owned private release management and owner-scoped my_releases for reads, because private projects have no public slug requirement.

- Derive Creator Pass XP and public standings from verified earned ledger kinds through visibility-checked functions, excluding refunds and spending, because progress tracks contributions, not balances.
- Adapt Creator OS presentation without importing its schema, hold-based benefits or 3D tilt, because existing permissions and reward rules remain authoritative.

- Read discussion through published-project-only functions with server-resolved public authors and owner writes, because private accounts must stay hidden. Comments award no rewards to avoid farming.
