

## Fix navigation to static pages + rebuild Selected Work loop

Two real bugs to fix, plus a Selected Work overhaul.

---

### Bug 1 — All static pages open blank (About / Projects / Events / Contact)

**Root cause:** Vite dev + Lovable hosting both fall back to `index.html` (the React app) for any unknown route. When the browser hits `/about`, the server doesn't know that's supposed to map to `public/about.html` — it serves React, which only has the homepage. Result: blank-ish page, or homepage flashes.

The previous "clean URL" change made it worse: `<a href="/about">` no longer matches a real file on disk (`about.html` exists but `/about` does not), so every link breaks.

**Fix:** Keep the URLs visually clean for the user, but make sure the link actually resolves to the real file.

- Change every `<a href="/about">` (and projects/events/contact) back to `href="/about.html"` etc., across `index.html`, `Navbar.tsx`, and all four static HTML files (nav + footer + inline CTAs).
- Keep the existing `URL-CLEAN` `<script>` at the top of each static HTML file — it rewrites the address bar from `/about.html` → `/about` *after* the page loads, so the visible URL stays clean.
- Net effect: visitor clicks "About" → browser requests `/about.html` (real file, loads instantly) → the inline script silently rewrites the address bar to `/about`. No blank pages.

### Bug 2 — Homepage Selected Work doesn't loop or scroll

The React `SelectedWork.tsx` only has 8 hardcoded projects, uses a CSS marquee that occasionally stalls, and offers no manual scrolling. You wanted: **a featured-only set, auto-looping AND draggable left/right.**

**Fix — rebuild `src/components/rhoze/SelectedWork.tsx`:**

- **Featured set (~12 projects)** — curated from the Projects page lineup: The Mask (Ooak), Mansa Musa (MONEE FINGAZ), Bombaaa, Feel Like A Superhero, Holy Water (Cozal), FATE (DUBZY33), iiMPCT Media, BK Whiskey x UN MMA, Telephone (Runner's Club), Nothing At All (Semiah), Photoshoot (YOUNG $TEELO), LeLongLegs.
- **Native horizontal scroller** — a real `overflow-x-auto` container so trackpad / mouse drag / touch swipe work natively left and right.
- **Auto-loop on top of it** — a JS `requestAnimationFrame` loop nudges `scrollLeft` forward at a steady pace; when it passes the halfway point of a duplicated track, it snaps back seamlessly (same pattern your `index.html` `workAutoScroll` script already uses successfully).
- **Pause on:** hover, focus, touch, *and* while the user is actively dragging — so manual scrolling never fights the auto-loop.
- **Click-and-drag support** added (mousedown → track movement → set scrollLeft).
- Edge fades + "See all projects" link preserved.
- Videos still `preload="none"` and only play on hover (no perf regression).

### Files to change

- `src/components/rhoze/Navbar.tsx` — restore `.html` on internal hrefs
- `src/components/rhoze/SelectedWork.tsx` — full rebuild (featured set + scrollable auto-loop)
- `index.html` — restore `.html` on nav, footer, and inline links (`/about`, `/projects`, `/events`, `/contact`)
- `public/about.html`, `public/projects.html`, `public/events.html`, `public/contact.html` — restore `.html` on every internal `<a href>` (nav, mobile menu, footer, CTAs); keep existing URL-CLEAN script intact

### Behavior after fix

| Action | Before | After |
|---|---|---|
| Click "About" / "Projects" / "Events" / "Contact" | Blank page | Page loads instantly, URL shows `/about` |
| Selected Work section | Static-feeling marquee, no manual control | Auto-scrolls; you can also grab and drag left/right; auto-loop pauses while you interact |
| Number of featured projects | 8 | ~12 curated highlights |

