- Keep the public talent marketplace in `creator_directory`, separate from private account `profiles`, because visitors must never gain access to payroll or account details through discovery.
- Mirror static page updates between `public/community.html` and `public/community/index.html`, because hosted direct `.html` and clean `/community/` URLs should match; link to `/community.html` for reliable Vite preview navigation.

- Keep public marketing navigation styles in `public/site-nav.css` and use the same links in static pages and the React `SiteNav` component, because visitors need consistent navigation while embedded and operational views retain their own controls.
- Mount the public floating booking action through `public/shared.js` for static pages and `SiteNav` for React pages, with shared styling in `public/site-nav.css`, so booking stays visible across menu destinations without duplicating page-specific markup.
- Derive brand identity from a slug of each release's creator name (matching `rz_slugify` in SQL and `slugify` in JS), with optional details in `brand_profiles`, because releases have no brand table and both sides must agree on URLs.
- Route profile edits through owner-checked database functions rather than direct table updates, so owners can never change approval, rating, or tier fields.
- Decide release ownership by the signed-in account (`releases.user_id`) through owner-checked database functions; the browser token only covers signed-out drafts until `release_claim` attaches them at sign-in, so owners can manage projects from any device.
