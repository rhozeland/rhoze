# Creation and release views
- Keep optional role details in release answers using role-details normalization for save/restore, and share the display across Review and public openings; this preserves the existing owner-checked save path without new storage.
- Discover role links use release-navigation to select and scroll to advertised openings without auto-opening applications; open-role visibility is independent of private team details so directory links never reach a hidden section.

- Crop project covers with react-easy-crop and upload a flattened 16:9 image, so existing project cards and pages preserve the chosen framing without schema changes.
- Keep market data in `pumpfun-coin` and embedded charts in `ReleasePrice`; unavailable prices/changes stay null so unindexed tokens never show invented performance.
- Keep expanded project-wizard screen keys in draft `answers.wizard_step` while retaining legacy `current_step` numbering, because existing saved drafts must reopen without a database migration.
- Keep Discover globe code under `src/create/globe/` fed only by public release and creator data, because discovery must never read private profile fields.
- Money state (milestone funded/approved/paid, payouts) changes only through the payments webhook and owner/admin-checked database functions, never browser writes, because payment status must be trustworthy.
- Store owner-editable story/context/contribution/source in release answers via release_save; use admin-write portfolio_details (public reads via portfolio_detail) for legacy archive metadata, because names must not confer ownership.
- Pair optional existing tokens through saved coin_mint in Scope/Budget without requiring ticker metadata, because unavailable market indexing must not block pairing.
- Keep portfolio likes as persistent owner-only identities with immutable project references and trigger-awarded points; unlike/re-like must never mint twice.
- Archive media uses validated YouTube URLs in a compact side column with photo fallback; paired-token statistics reuse pumpfun-coin and ReleasePrice, so stories lead without fabricated market data.
