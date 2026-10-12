# Creation and release views

- Crop project covers with react-easy-crop and upload a flattened 16:9 image, so existing project cards and pages preserve the chosen framing without schema changes.
- Keep release market data in the existing `pumpfun-coin` lookup and the collapsible display in `ReleasePrice`; return null for unavailable daily changes so unindexed coins never show fabricated performance.
- Keep expanded project-wizard screen keys in draft `answers.wizard_step` while retaining legacy `current_step` numbering, because existing saved drafts must reopen without a database migration.
- Keep Discover globe code under `src/create/globe/` fed only by public release and creator data, because discovery must never read private profile fields.