# Symbiotic V3 — Amadeus-native 12 milestone roadmap

**Strict scope:** native Amadeus public testnet. Only `TESTBTC/AMA` and `TESTUSD/AMA` spot markets; AMA is the only quote asset. Derivatives, RWA, Notional and Options are visibly **Coming Soon**. Every on-chain claim requires independent explorer evidence.

**Tracking:** These GitHub issues serve as milestone trackers; they are not GitHub's native Milestones objects. Detailed checklists and acceptance gates live in each issue.

## [M1 — Amadeus-only extraction](https://github.com/mushee-io/Symbiotic-V3/issues/1)

Replace imported chain-specific code with native testnet starter app and CI; no incompatible dependencies. Validate build, architecture, and deletion.

**Acceptance:** Clean tree, passing tests, no legacy code.

## [M2 — Testnet SDK & connectivity](https://github.com/mushee-io/Symbiotic-V3/issues/2)

RPC, chain tip, errors, reconnection and no mainnet fallback.

**Acceptance:** Real SDK chain height, fail-closed offline state.

## [M3 — Native AMA wallets](https://github.com/mushee-io/Symbiotic-V3/issues/3)

Connect/disconnect, wallet network detection, balances, explicit signing.

**Acceptance:** Two test wallets verified on Amadeus testnet.

## [M4 — Two native test assets](https://github.com/mushee-io/Symbiotic-V3/issues/4)

Create TESTBTC and TESTUSD with on-chain mint receipts and independent balance checks.

**Acceptance:** Two verified native test token issuance records.

## [M5 — Spot AMM contract design](https://github.com/mushee-io/Symbiotic-V3/issues/5)

Specify native constant-product swaps, fee accounting, slippage, precision and LP math.

**Acceptance:** Reviewed design and tested AMM invariants.

## [M6 — Deploy two native AMA pools](https://github.com/mushee-io/Symbiotic-V3/issues/6)

Build/deploy smart contracts for TESTBTC/AMA and TESTUSD/AMA only.

**Acceptance:** Contract addresses and public testnet deployments.

## [M7 — Seed real liquidity](https://github.com/mushee-io/Symbiotic-V3/issues/7)

Fund pools with test AMA and issued test assets; add and remove liquidity.

**Acceptance:** Verified pool reserve state and liquidity receipts.

## [M8 — Real spot buy/sell](https://github.com/mushee-io/Symbiotic-V3/issues/8)

Wallet-sign, submit and verify swaps in both directions for both pairs.

**Acceptance:** Four independently verifiable spot swap scenarios.

## [M9 — On-chain spot terminal](https://github.com/mushee-io/Symbiotic-V3/issues/9)

Live native balances, reserves, swap history and source-linked pool price.

**Acceptance:** No fictitious markets, balances, prices, candles or fills.

## [M10 — Guardrailed AI market maker](https://github.com/mushee-io/Symbiotic-V3/issues/10)

Automate bounded liquidity actions with operator pause, logs, inventory caps and verified prices.

**Acceptance:** Agent audit trail with real testnet action receipts; no wash volume.

## [M11 — Security & CI acceptance](https://github.com/mushee-io/Symbiotic-V3/issues/11)

Resilience, slippage, failure-mode, wallet rejection, precision and contract security testing.

**Acceptance:** CI passing; risks documented; fail-closed drills.

## [M12 — Public demo & ecosystem proposal](https://github.com/mushee-io/Symbiotic-V3/issues/12)

Deploy truthful testnet spot demo, link explorer evidence, and prepare companion 33JACK pitch.

**Acceptance:** Public demo, two-wallet demo and proposal; advanced markets Coming Soon.

## Non-negotiable acceptance

No fake pools, trading volume, prices, wallet balances, or synthetic receipts. A UI showing a network height does not prove that an exchange contract has been deployed. Unimplemented trading controls stay disabled; on-chain trading is not operational until M8 receipts have been checked.
