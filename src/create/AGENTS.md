# Creation and release views

- Crop project covers with react-easy-crop and upload a flattened 16:9 image, so existing project cards and pages preserve the chosen framing without schema changes.
- Keep market data in `pumpfun-coin` and embedded charts in `ReleasePrice`; unavailable prices/changes stay null so unindexed tokens never show invented performance.
- Keep expanded project-wizard screen keys in draft `answers.wizard_step` while retaining legacy `current_step` numbering, because existing saved drafts must reopen without a database migration.
- Keep Discover globe code under `src/create/globe/` fed only by public release and creator data, because discovery must never read private profile fields.
- Money state (milestone funded/approved/paid, payouts) changes only through the payments webhook and owner/admin-checked database functions, never browser writes, because payment status must be trustworthy.
- Store owner-editable story/context/contribution/source in release answers via release_save; use admin-write portfolio_details for legacy archive metadata, because names must not confer ownership.
- Pair optional existing tokens through saved coin_mint in Scope/Budget without requiring ticker metadata, because unavailable market indexing must not block pairing.
