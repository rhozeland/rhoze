# Apply the Figma homepage redesign

## Goal
Rebuild the public homepage to closely match the supplied reference while preserving Rhozeland’s existing working links, sign-in state, workspace entry points, live market data, automated community leaderboard, and editable news feed.

## Changes
- Replace the current dashboard-style first screen with the reference’s airy gradient introduction, compact navigation, announcement strip, bold headline, and two primary actions.
- Recompose Featured Work as a dense two-row visual rail using the existing project library, with category labels and a clear projects link.
- Add the three creator-path cards, the dark “Why Rhozeland?” value section, the 1000+ collaboration statement, and the gradient-backed story timeline.
- Present membership options as a clean four-card row, using the site’s existing plan names, pricing, credit logic, and working start links.
- Move partner recognition into the lower dark section and simplify the footer to match the reference.
- Preserve the automated chart and leaderboard logic without featuring them as oversized homepage panels.
- Keep desktop, tablet, mobile, light/dark themes, reduced-motion behavior, and the existing homepage overlays functional.

## Technical details
- Update the static homepage in `index.html`, which currently serves `/`.
- Reuse current project images under `/public/images`; the uploaded screenshot remains a visual reference only.
- Keep the existing authentication, analytics, workspace, news, market-price, and leaderboard scripts intact; adjust only their presentation and placement.
- Verify the result in Chromium at desktop and mobile widths, then check the latest preview health signal.
