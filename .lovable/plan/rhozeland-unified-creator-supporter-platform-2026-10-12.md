# Rhozeland unified creator + supporter platform

Deadline: Colosseum closes Monday Oct 12, 12:00 AM Pacific = **Monday Oct 12, 3:00 AM Eastern** (about 6 hours from now). Work is ordered so the most demo-visible pieces land first; anything unfinished at the deadline is described as "in progress" in the submission, never as live.

## Wave 1 — Product core (tonight, before submission)
1. **One account, two paths** — at sign-up/profile setup, choose "I create" (Artist or Brand) or "I support". Anyone can switch or do both later. Existing account types carry over (Supporter stays Supporter).
2. **Merged 4-step Create flow** (Artist and Brand share one flow; the account type only changes suggestions and defaults):
   - Idea: name, what you're making (AI help), brief description (AI help), category, optional cover
   - Scope: budget range + timeline, or "Need a quote"
   - Who's making it: Work with Rhozeland / My own team / Open roles (any combination)
   - Review: save private or publish
   - Split, roadmap, coin and roles move to the project page, editable anytime. Old drafts still reopen.
3. **Create project button** on the dashboard (profile/me) and on Discover.
4. **Project workspace vs public view** on the release page: owners see four tabs — Overview, Plan (roadmap + deliverables), Team & chat, Money (budget, split, coin). Each section has a "Show publicly" switch; visitors see only switched-on sections plus public metrics.

## Wave 2 — Discovery + supporters (tonight if time allows, otherwise next)
5. **Spinning globe on Discover** — ported from Creator OS (drag-to-spin, city pins for creators, brands and projects, spotlight card on pin click, "Start a project here" button). Respects reduced motion. Overrides the previous "no 3D elements" rule at the user's request.
6. **Supporter home** — projects I back/liked, coins I hold (connected wallet), perks unlocked, suggested creators.
7. **Public project metrics** — supporters/likes, roadmap progress %, coin market cap, open roles count, shown on cards and the project page.

## Wave 3 — Studio business (after submission)
8. "Work with Rhozeland" requests land in the team inbox; team assigns members and sends a quote.
9. Quote approval -> deposit -> milestone approvals -> final payment, built on the existing project payments and milestones in the team portal.

## Wave 4 — Story (in parallel, delivered as copy-paste text)
10. Updated Colosseum answers reflecting what's actually live after Wave 1/2.
11. Brand refresh notes + pitch deck outline built from the real product (deck file after submission).

## Technical details
- Create flow: rewrite step list in `src/create/CreateProject.tsx`; keep `answers.wizard_step` mapping so legacy step keys resolve to the nearest new step.
- "Who's making it" and section visibility stored inside the existing release `data` JSON (no new tables) via `release_save`; public rendering filters on those flags in `ReleasePage.tsx`.
- Account intent stored on the existing profile through the owner-checked profile functions (new function `profile_set_intent` if needed); no roles derived from it.
- Globe: port `DiscoverGlobe.tsx` + regions lib from Creator OS into `src/create/`, fed by `creator_directory` cities and published releases; mounted at top of `DiscoverPage.tsx`.
- Metrics: one read-only database function returning likes, progress and roles count per published release.
- Wave 3 reuses `project_milestones`, `project_payments`, `project_line_items`; needs its own plan.
- Verify each wave with Playwright on desktop and 390px mobile; update `roadmap.md` and `AGENTS.md`.
