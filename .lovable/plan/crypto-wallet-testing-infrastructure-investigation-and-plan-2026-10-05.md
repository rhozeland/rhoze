# Crypto / Wallet Testing Infrastructure — Investigation and Plan

Investigation only. No files, dependencies, wallets or transactions are changed.

## Current State

### What exists
- **Read-only chain access, mainnet only.** RPC endpoints are hardcoded:
  - `supabase/functions/wallet-lookup/index.ts` and `supabase/functions/rhoze-trades/index.ts`: `mainnet.helius-rpc.com` when `HELIUS_API_KEY` is set, otherwise `api.mainnet-beta.solana.com`.
  - `src/lib/rhozeChain.ts`: browser calls `api.mainnet-beta.solana.com` directly as a fallback.
- **Production mint hardcoded in 5 places:** `7khGn21…pump` in `rhozeChain.ts`, `WalletPanel.tsx`, `Chart.tsx` (twice, incl. Birdeye iframe URL), `wallet-lookup`, `rhoze-trades`. Pair address also hardcoded in `wallet-lookup`.
- **Custodial wallet creation:** `wallet-provision` generates an Ed25519 keypair (`@solana/web3.js` in Deno), AES-GCM encrypts it with `WALLET_ENCRYPTION_KEY`, stores in `user_wallets`. Keys are network-agnostic but nothing ever signs or broadcasts.
- **External wallet "linking":** `wallet-replace-external` only checks the address is valid base58. No signature/ownership proof.
- **$RHOZE rewards are off-chain database ledgers:** `rhoze_balances`, `rhoze_ledger`, `rhoze_settings`; trigger `_rhoze_on_payment`, RPCs `rhoze_award`, `admin_fulfill_investor_pledge`, `purchase_rhoze_square`. Credits: `apply_project_topup`, `apply_tier_credits`, `credit_request_*`.
- **Environment separation exists only for Stripe:** `.env.development` (`pk_test_`) vs `.env.production` (`pk_live_`), `subscriptions.environment`, `PaymentTestModeBanner`, `has_active_subscription(check_env)`.
- **Test tooling installed:** Vitest (`npm test`), Playwright config/fixture.

### What does not exist
1. No dedicated crypto test/dev environment.
2. No Devnet/Testnet config anywhere (zero references).
3. No test wallets, no mock wallet, no wallet adapter (no Phantom/Solflare integration).
4. No env-specific RPC, mint, pair, or destination config — all hardcoded.
5. No mocked RPC/transaction layer.
6. No tests touching wallets, transactions, rewards or credits. Only tests: `src/test/example.test.ts` (placeholder) and `src/team/lib/__tests__/validateDocForm.test.ts`. No Deno tests for edge functions.
7. No guard against mainnet use — there is nothing to guard yet because nothing writes on-chain, but there is also no switch.
8. No staging backend: one Lovable Cloud instance serves both preview and the published site, so preview testing writes to production data.

### Relies on mainnet for dev/testing?
Yes. Every chain read in preview and production hits mainnet with the live mint. This is low-risk today only because all chain access is read-only.

### Notable finding
`purchase_rhoze_square` (as currently defined) awards $RHOZE to any signed-in caller for any amount ≥ $50 with an optional, unverified order reference — no payment confirmation server-side. Worth reviewing before any testing work, and the first thing automated tests should cover.

## Recommended Implementation

Keep existing stack: Vitest, Playwright, Deno edge functions, `@solana/web3.js` (already used server-side), Lovable Cloud.

1. **Single chain config module** (`src/lib/chainConfig.ts` + `supabase/functions/_shared/chain.ts`): `SOLANA_CLUSTER` (`devnet` | `mainnet-beta`), RPC URL, mint, pair, treasury/destination addresses. Frontend via `VITE_SOLANA_CLUSTER`, `VITE_RHOZE_MINT` in `.env.development` / `.env.production` (same pattern as Stripe). Edge functions via secrets. Replace the 5 hardcoded mint references and 3 RPC URLs.
2. **Devnet test token:** a Rhoze devnet SPL mint and devnet treasury wallet, created once by a team member with a throwaway keypair; addresses (public only) stored in dev config.
3. **Test wallets:** devnet-only keypairs for automated tests, stored as secrets, funded by devnet airdrop. A `MockWalletProvider` for UI tests that implements connect / signMessage / signTransaction with a local keypair.
4. **Mainnet guard:** a `assertSafeCluster()` helper that throws if cluster is mainnet while running in preview/test, or if a mainnet mint is paired with a devnet RPC; a visible "Devnet" banner like `PaymentTestModeBanner`; custodial wallet rows tagged with `network`.
5. **Mocked RPC layer:** inject a fetch-based RPC client so Vitest and Deno tests can replay recorded responses (success, failed tx, invalid address, duplicate signature, 429).
6. **Automated tests:**
   - Unit (Vitest): `parseTx`, `buildCandles`, address validation, config guard.
   - Edge functions (Deno test): wallet-provision (unauthorized 401, idempotent), wallet-replace-external (invalid, unauthorized), wallet-lookup (invalid address 400).
   - Database (SQL tests against a branch/draft backend): `apply_project_topup` duplicate session ignored and non-service-role rejected; `_rhoze_on_payment` award math and first-project bonus once only; `rhoze_award` non-team rejected; credit request state machine; `purchase_rhoze_square` limits.
   - Devnet integration (opt-in, not in default `npm test`): real transfer, verify signature, duplicate submission rejected.
7. **Backend separation:** use Lovable drafts (isolated backend per draft) for destructive DB tests rather than the shared production instance.
8. **Docs:** `docs/crypto-testing.md` — setup, getting devnet SOL, running each test tier, what must never be committed.

## Complexity and Effort

Overall: **Medium** today (read-only chain), rising to **High** once on-chain signing/escrow is built.

| Phase | Work | Estimate |
|---|---|---|
| 1 | Chain config module, replace hardcoded mint/RPC, env files, mainnet guard + banner | few hours – 1 day |
| 2 | Devnet mint, treasury, test keypairs, mock wallet provider | 1 day |
| 3 | Mock RPC layer + unit tests for chain parsing | 1 day |
| 4 | Edge function Deno tests | 1–2 days |
| 5 | Database tests for rewards/credits on isolated backend | 2–3 days |
| 6 | Opt-in devnet integration tests | 1–2 days (only meaningful after signing exists) |
| 7 | Developer docs | few hours |

Could get unexpectedly complex / needs team decisions:
- Pump.fun, DexScreener, Birdeye have no devnet equivalent; market data and chart stay mainnet or get mocked.
- Whether custodial keys should exist at all before a key-management review.
- Which backend to use for staging (drafts vs a separate project).
- How Square purchases are verified.

## Risks and Prerequisites
- **Security:** unverified external wallet linking; custodial secrets protected by one env key; `purchase_rhoze_square` trust model.
- **Mainnet risk:** hardcoded mainnet RPC + mint means any future write code would default to mainnet.
- **Key management:** test keypairs must be devnet-only, never reused, never committed; one encryption key shared across environments today.
- **Devnet limits:** airdrop rate limits, periodic resets, public RPC throttling (Helius offers devnet keys).
- **Environment separation:** single shared backend means preview tests touch real balances and ledgers.
- **Architecture:** chain constants scattered across frontend, edge functions, and an iframe URL.

## Final Recommendation
1. **Priority:** High, and a prerequisite before building any on-chain signing, escrow, or wallet adapter work.
2. **Minimum viable:** Phases 1, 3, and 5 — central config with mainnet guard, mocked RPC unit tests, and database tests for rewards/credits on an isolated backend (including the Square purchase path).
3. **Long-term:** full devnet mint and test wallets, mock wallet provider for Playwright, Deno edge tests, opt-in devnet integration suite in CI, separate staging backend.
4. **Overall complexity:** Medium (roughly 1–2 weeks for one developer), High once transaction execution is added.

If approved, I can save this report as `docs/crypto-testing-plan.md` without changing any app code.
