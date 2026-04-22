

## Bump Selected Work to ~20 + compress oversized thumbnails

Two things in one pass: more featured projects on the homepage, and a real fix for the heavy image files dragging performance down everywhere they appear.

---

### Part 1 — Selected Work: 12 → 20 featured projects

Curate 20 of the strongest projects from the Projects page into the homepage carousel. DOM goes from 36 cards (12 × 3 clones) to 60 cards — still well within safe range, no perf regression expected since videos remain `preload="none"` and only initialize on hover.

**Updated featured list (20):**

Existing 12 + adding:
- Withdrawals — Semiah
- Sensimelia — Julz
- Baby Blue — Godfrey Noir
- Solo Para Ti — DUBZY33
- Loyal — Cozal
- The Eulogy — Ooak
- Runner's Club (additional cut)
- One more standout from the projects.html lineup

Final picks confirmed against `public/projects.html` so every entry has a real thumbnail + working link.

### Part 2 — Compress oversized thumbnails

Real lag culprit. Audit every image in `/public/images/`, re-encode anything over ~150 KB. Targets:

| File | Current | Target |
|---|---|---|
| `julz-sensimelia.png` | 1.2 MB | ~120 KB |
| `godfrey-noir-baby-blue.png` | 939 KB | ~120 KB |
| Any other PNG > 200 KB | varies | ~150 KB |

**How:**
- Run a sweep over `public/images/` and identify every file > 200 KB.
- Re-encode each with `sharp` (already common in the toolchain) or `imagemagick`:
  - PNGs → high-quality WebP at quality 82, max-width 800px (cards display at 340px, so 800px covers retina).
  - Keep `.png` extension fallback only if a file is referenced by name elsewhere; otherwise swap references to `.webp`.
- Overwrite originals in place so no link updates needed across `index.html` / `projects.html` / `SelectedWork.tsx`.

**Expected wins:**
- 1.2 MB → ~120 KB = **90% smaller**
- Total page weight on homepage Selected Work + Projects page should drop by several MB
- Mobile load + scroll feel noticeably snappier

### Part 3 — Bonus cleanup

While we're in there:
- Delete or re-encode the 6 MB `.mov` file in `/public/videos/` if still referenced (or remove if unused).
- Quick scan for any stray uncompressed assets > 1 MB and flag them.

### Files touched

- `src/components/rhoze/SelectedWork.tsx` — expand featured array from 12 to 20
- `index.html` — same expansion in the static `workStrip` markup
- `public/images/*.png` — compress + re-encode in place
- `public/videos/*.mov` — delete or compress if unused

### Behavior after

| Before | After |
|---|---|
| 12 featured projects | 20 featured projects |
| 1.2 MB image loads on Projects page | ~120 KB |
| Carousel feels heavy on mobile | Snappier scroll, faster paint |
| ~36 DOM cards in loop | ~60 DOM cards (still smooth) |

