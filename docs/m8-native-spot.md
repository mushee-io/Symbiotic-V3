# M8 — Native Amadeus AMA spot BUY / SELL

Issue: https://github.com/mushee-io/Symbiotic-V3/issues/8

## Status and strict scope

**M8 implements the read-only spot quote, unsigned swap-intent builder, fail-closed native BUY/SELL panel, and finality/ledger witness verifier. It does not activate live trading.** There are no on-chain swap receipts, market prices, trade fills, historical volumes or running AI market makers in this milestone.

Exactly two pools, quoted and settled in AMA:
- TESTBTC/AMA
- TESTUSD/AMA

Perpetuals, RWA, options, alternate chains, fiat prices and third tokens remain out of scope.

## Actual on-chain reserve-backed quotes

The read-only endpoint at /api/spot/quote takes base (TESTBTC or TESTUSD), side (BUY or SELL), amount (positive exact atomic units), slippageBps (integer 1–500), and optional owner (48-byte Base58 native account). It never signs or broadcasts.

1. Verify pinned Amadeus public testnet chain tip and chain statistics, without mainnet fallback.
2. Require code-reviewed certified pool contract from M7. **Both approved pool addresses are currently NULL.** Neither generic RPC health nor unsigned ELFs activate an exchange.
3. For an independently certified pool, read native get_base and get_reserves views, optional get_lp for the connected wallet, and actual pool native Coin balances. Re-read reserves to reject unstable snapshots; require custody amounts exactly equal storage. Refuse paused, empty or malformed pools and precision errors.
4. For BUY, attach AMA and receive base; for SELL, attach base and receive AMA. Exactly 30 bps fee remains inside reserves. All computations use bounded atomic BigInt with floor rounding, never floating point.
5. Exact-output math: out = floor((amountIn * 9970 * reserveOut) / (reserveIn * 10000 + amountIn * 9970)). Require K-after >= K-before.
6. User minOut = floor(out * (10000 - slippageBps) / 10000), strictly positive. Reject dust and reserve overflows.
7. Report effective reserve-ratio deviation including fee, not a third-party price oracle.

When no pool is certified, return status blocked, quote null, snapshot null and tradingEnabled false. An invalid request returns HTTP 400; RPC/reconciliation failures return 503. No unverified price or volume is displayed.

## Native swap approval intent and critical wallet limitation

The M8 intent builder creates a **review-only** native swap_exact_in(minimumOut,deadlineHeight) intention with a single attached Coin:
- BUY TESTBTC/AMA or TESTUSD/AMA: AMA input Coin attached.
- SELL: selected test asset input Coin attached, AMA output.
- Recheck exact attached symbol, amount, pool address, caller identity, immutable AMA quote, output amount, 30 bps fee and minimumOut.
- Require quote no older than 3 native chain heights and deadline at most 20 blocks later. Reject any reprice or pool change.
- All intents explicitly carry walletApprovalRequired true and broadcastEnabled false.

The documented Amadeus injected wallet signTransaction API only describes contract/method/args/description. It does **not** document native attached Coin signing or an authoritative network domain query. The app therefore never invokes wallet signing for a swap and never submits it, even when a provider reports a testnet label. The direct signing guard is deliberately fail-closed. Production swap acceptance flags remain null for both pairs, independently of the null deployment registry.

The homepage no longer displays a misleading 0.00 phantom quote. The native wallet panel now contains a BUY/SELL selection, exact atomic input, configurable slippage, verified quote refresh, minimum receive, fee and quote height when available, an unsigned preview, and a permanently disabled execute control.

## Finalized execution and balance witness (prepared, not exercised live)

The receipt verifier accepts actual independent observations of an already executed transaction. It requires:

1. Exact signed hash, correct authorized wallet signer, contract, function swap_exact_in, minOut/deadline args, **attached_symbol and attached_amount**; if native attached Coin evidence is absent, reject.
2. Successful finalized native testnet execution and ledger height between quote and signed deadline.
3. Two separately reconciled native pool reserve snapshots and actual Coin contract custody. Reserve delta must equal exact input/expected output for each direction. Total LP and caller LP shares must be unchanged, and K may not decrease.
4. Actual native public-wallet Coin balance observations, before and after, for the trader. The base Coin change must exactly match the swap; AMA balance also changes for network gas, so it is checked against the gross swap debit/credit without falsely claiming the exact gas fee.
5. Reject any pending, reverted, mismatched/forged, expired, custody-inconsistent, altered-balance, wrong network or wallet-hash-only evidence.

No finalized public swap receipt is known. Mock receipts are tests of the logic, NOT real trades.

## CI and live acceptance

Run npm run typecheck, npm test, npm run build, both existing no_std Rust host test suites. GitHub CI also rebuilds both actual Amadeus RISC-V ELFs and probes the public testnet RPC/Coin states read-only.

M8 must remain OPEN until independently witnessed:
- M3 two real testnet wallets + authoritative signing-network attestation.
- M4 two native test token finalized mints, balances and globally valid symbols.
- M6 deployed native pools with real successful finalized receipts, secure initialization, VM runtime Coin custody/rollback/gas testing.
- M7 real signed liquidity deposits and withdrawals on both pools with reconciled native reserves and LP shares.
- Official wallet attachment-aware native swap signing, safe wallet approval, no keys.
- Four genuine testnet direction receipts: BUY and SELL TESTBTC/AMA; BUY and SELL TESTUSD/AMA, across two independent wallets, with actual wallet and reserves reconciliation.
- Handling of wallet rejection, stale quotes, slippage, deadline expiry, RPC outages, paused pools and native revert.

No live swaps, artificial fill history, fabricated transaction hashes or speculative liquidity claims. M9 terminal development can proceed behind these safety gates.
