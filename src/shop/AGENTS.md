# Shopify shop
- Use Shopify Storefront API 2025-07 for live products and cart mutations, because stock, prices and checkout must remain Shopify-authoritative.
- Persist cart responses in Zustand and refresh on visibility changes; checkout uses only API-issued URLs with channel=online_store in a new tab, because embedded checkout is unsupported.
- Keep Shop public within Rewards and local product pages inside Shell; never spend ledger balances or issue discount codes client-side, because redemption needs trusted accounting.