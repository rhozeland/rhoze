- Keep the public talent marketplace in `creator_directory`, separate from private account `profiles`, because visitors must never gain access to payroll or account details through discovery.
- Mirror static page updates between `public/community.html` and `public/community/index.html`, because hosted direct `.html` and clean `/community/` URLs should match; link to `/community.html` for reliable Vite preview navigation.

- Keep public marketing navigation styles in `public/site-nav.css` and use the same links in static pages and the React `SiteNav` component, because visitors need consistent navigation while embedded and operational views retain their own controls.
