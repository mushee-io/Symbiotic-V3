# M10 — Guardrailed AMA-native AI-assisted market maker (read-only research)

Tracking: https://github.com/mushee-io/Symbiotic-V3/issues/10

## Verified status

M10 delivers a **deterministic, transparent risk/strategy analyzer and audit view**, not a running AI trading bot, market maker, an AI/LLM inference engine, a keeper, or a signer. It does not post orders, deploy contracts, supply liquidity, generate volume, send transactions, or consume private keys. In particular, **there are NO public testnet transaction receipts from an automated agent**.

Only TESTBTC/AMA and TESTUSD/AMA are permitted. AMA is the only quote and fee asset. No Cardano, EVM, third token, perp, RWA, wash trades, speculative token price/volume or mainnet fallback.

## Native monitoring: verified sources only

GET /api/agent/monitor?base=TESTBTC&owner=PUBLIC_48_BYTE_ACCOUNT returns a read-only native testnet decision envelope, bounded risk policy and SHA-256 audit digest. It uses the pinned Amadeus SDK at https://testnet-rpc.ama.one/api, through the previous M9 native terminal reader:

1. Read real native chain tip and rooted heights.
2. Read native Coin symbol registration; reject unregistered TESTBTC or TESTUSD as portfolio assets rather than inserting zero balances.
3. Read public connected wallet native AMA balance, and the selected base Coin only if the symbol actually exists, with exact atomic precision and no overlarge JS integer conversions.
4. **Only for a code-reviewed certified pool (both are still null)**, read real native get_base/get_reserves/get_lp contract views, two actual Coin custody balances, and independently recheck reserve stability.
5. **Only for a certified pool with a connected public wallet**, query and verify native finalized transaction history as in M9, without deriving fake trade output or wallet PnL.
6. There is **no independently verified external reference AMA/base price oracle and no finalized daily realized/unrealized PnL ledger** integrated. The monitor explicitly passes reference:null and pnl:null. A successful RPC or single chain reserve ratio is not independent price discovery, and a swap-call receipt does not by itself prove economic PnL.

**Result on actual current testnet: HOLD**. Unregistered assets, missing certified pools, unknown reference and missing daily PnL mean no positive strategy signal or action. Inaccurate, stale or unavailable RPC returns HTTP 503 and audit:null rather than fictional signals.

## Strategy and risk policy

lib/agent/policy.ts exposes a pure, deterministic BigInt strategy evaluation function, with synthetic fixture tests **clearly identified as mock tests, never live trades**.

Configurable bounds include:

- Target base-token inventory in bps of native AMA-equivalent holdings and rebalancing deadband. AMA-equivalent base valuation comes only from real, custody-reconciled reserve ratios.
- Indicative reference spread (30–1000 bps) as a **research-only price band** around an independently attested reference. It does not alter an Amadeus AMM contract's 30-bps fee and does not create bid/ask limit orders.
- Maximum user slippage 1–100 bps, maximum simulated pool utilization 1–100 bps, maximum independent reference divergence 1–500 bps.
- Positive atomic AMA maximum trade, maximum total base-position notional, daily loss limit and minimum native AMA gas reserve. Hard server policy limits prevent arbitrarily large amounts even if users change browser inputs.
- Deterministic BUY recommendation when base inventory is below the target band, SELL when above, and HOLD within the target range. Both quotes use M8 exact-input fee-aware native constant-product math, no synthetic reference market.
- Strict STOP/HOLD for missing independent reference, missing authentic daily PnL evidence, stale chain root, paused/empty pool, corrupt or mismatched custody, missing wallet/asset, excessive divergence, loss-cap hit, insufficient gas, inventory/position cap, bad math/precision or slippage impact.
- Indicative spread band is explanatory only. It is **not a promise of profitability, achievable spread, execution, or a displayed market price**.

**Every evaluation outputs canSign:false, canBroadcast:false, executionApproved:false**, including valid candidate signals in pure unit tests. Live API never supplies mock external-price/PnL evidence and cannot return an executable intent.

## Operator approval, pause, stop and kill switch

The client renders explicit operator pause and kill-switch checkboxes, initially engaged. The server defaults to both engaged and returns authentication approval false forever. The user can turn these preview toggles off **only for local read-only research**. Public GET query parameters cannot attest wallet permission, oracle values, daily PnL, deployment evidence, or actual execution approval. There are no PATCH/POST signing or bot endpoints.

**These are not persistent backend-wide emergency stop controls**, because no trading daemon or server-side operator authentication exists. The actual hard kill is structural: no agent execution/broadcast endpoints, no key material, and existing M3–M9 swap/lending signing gates remain disabled. Do NOT describe a browser checkbox as a financial-production kill switch.

The dashboard automatically refreshes read-only testnet observations about once per minute and allows manual refresh; it never submits orders. Invalid parameters fail before any RPC request.

## Decision audit and reproducibility

lib/agent/audit.ts constructs a canonical field-sorted JSON decision envelope with:

- schema symbiotic.m10.decision.v1 and exact chain/testnet identity;
- full validated policy bounds and local pause/kill request;
- two-market source, chain tip/rooted heights, pool/token/wallet verified/not verified flags;
- explicit lack of independent reference and daily PnL data;
- HOLD reasons, or research-only candidate detail when testing pure engine with synthetic fixtures;
- SHA-256 digest calculated from the canonical JSON. **This digest is not a transaction ID, receipt, database record, or exchange event.**

Client has a Copy JSON audit action for operator retention. Server responses declare durableStorage:false: **no append-only durable database or external evidence archive exists yet**. Saving the audit externally is required before claiming a permanent audit log. The current site cannot impersonate an operator-signed, immutable execution log.

## Test suite, CI and real-chain acceptance

Automated unit/integration tests cover two AMA pairs, bounded config parsing/overflow, spoofed oracle/PnL/approval, no mainnet failover, paused and killed states, gas reserve for BUY and SELL, inventory rebalancing, reference divergence, loss caps, quote slippage, stale rooted heights, missing pools/wallet/coin issuance, native balance precision, canonical SHA-256 reproducibility, forged audit fields, and absence of trading routes. Existing M1–M9 tests, two Rust no_std test suites and both real RISC-V contract ELF compilations are retained.

Run npm run typecheck, npm test, npm run build, both existing Rust test suites and GitHub CI.

**M10 issue must stay OPEN** until independent real-chain and operator security acceptance establishes:

- [ ] M3: two independent real Amadeus testnet wallet approvals and trustworthy native signing-domain attestation.
- [ ] M4: TESTBTC and TESTUSD issued via finalized native mint receipts with verified global state and issuer balances.
- [ ] M6: two actually deployed pair-specific native RISC-V pool contracts, secure initializer, native runtime transfer/rollback and authenticated bytecode receipts.
- [ ] M7: two actual funded pools, verified native LP deposits/withdrawals and real reserve-to-Coin custody reconciliation.
- [ ] M8: wallet-attached native Coin signing, real testnet BUY+SELL swaps for both pairs, finalized receipts and matching before/after reserves and owner balances.
- [ ] M9: genuine two-wallet end-to-end live trading terminal demo with accurate explorer-linked chain history.
- [ ] A truly independent signed/or otherwise verifiable external price source and independently reconciled **daily total PnL** ledger, not mock values or self-reported reserve ratios.
- [ ] Authenticated and durable operator policies, explicit individual approval/rejection, backend-enforced persistent pause, stop/kill, rate/budget controls and external receipt/audit retention.
- [ ] A non-manipulative, independently witnessed two-wallet **testnet-only** agent scenario with real approved transactions, gas/fee accounting, before/after inventory and pool states, real pause/kill drills and **no self-trading/wash volume**.
- [ ] Security review and chain failure-mode acceptance before any unattended automated action.

Current code is a safety-bounded **simulation/research candidate** that will never make a real trade by itself. The native testnet pool and token blockers remain visible and incomplete issues #3/#4/#6/#7/#8/#9 stay OPEN.

M11 (security & CI acceptance) should build adversarial failure drills and hardening without circumventing these gates.
