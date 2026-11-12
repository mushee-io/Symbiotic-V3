# M7 — Amadeus native AMA pool liquidity and reconciliation

Issue: https://github.com/mushee-io/Symbiotic-V3/issues/7

## Status (must remain accurate)

**Code-level M7 integration only. No pools have been publicly deployed, initialized, funded or traded.** Prior M3/M4/M6 gates remain open. This milestone implements read-only reconciliation and unsigned transaction intent construction, **not** an active liquidity feature or a working wallet-approval deployment. No private keys, API secrets or synthetic reserves are used.

The only allowed pairs remain TESTBTC/AMA and TESTUSD/AMA, with AMA always the quote token. No perpetuals, RWA or other liquidity markets are live.

## Independent safety gates

The permanent, code-reviewed deployment registry is lib/liquidity/deployments.ts and intentionally contains:

- TESTBTC: null
- TESTUSD: null

An unverified environment variable, URL parameter or wallet address **cannot** populate it. Both entries may be populated in a separately reviewed change **only after** two real final deployment transactions, initialized-contract evidence, on-chain runtime security testing, finalized token mints, and M3 two-wallet signing-domain witness.

The deployed native contract public address must decode to precisely **48 bytes**. A chain-view success does not prove that bytecode matches the approved ELF; before registry activation verify bytecode identity, source hash and contract guest feature. The chain's account/caller permissions and native Coin storage must be separately validated.

## Read-only API and native state integrity

GET /api/liquidity/status?owner=PUBLIC_BASE58_ADDRESS uses only the pinned SDK at https://testnet-rpc.ama.one/api. No other RPC network is permitted, including mainnet.

For each **certified** pool the endpoint performs:

1. Actual testnet tip/rooted chain health verification.
2. Native contract.view(get_base), verify compiled base symbol.
3. Native contract.view(get_reserves), parse BASE|AMA|totalLP|paused as exact BigInt atomic units and reject malformed/empty values.
4. Native Coin balances from wallet.getBalance(contractAddress, BASE) and wallet.getBalance(contractAddress, AMA), rejecting wrong symbols and unsafe JS integer precision instead of rounding.
5. Optional native contract.view(get_lp) with the 48-byte public caller account in pk; reject missing/corrupt or excessive caller shares.
6. Read get_reserves again to reject a changing state while reading; require exact native Coin custody equality with each stored reserve. Direct donations or concurrent state changes trigger a fail-closed "unavailable" state rather than silently changing LP value.

No certificate => status BLOCKED and state:null, not zero reserves. RPC unavailable => HTTP 503; invalid owner => HTTP 400. Client discards stale requests on account switching and never displays simulated holdings. API returns tradingEnabled=false and liquidityEnabled=false unconditionally.

## Native wallet-approved *intent* construction

Source: lib/liquidity/intent.ts.

- Add: native M6 add_liquidity(minimumLP, expiryEntryHeight), with exactly two Coin attachments: full requested BASE and AMA amounts. M6 sends back excess attached Coins; preview calculates the accepted proportional amounts from the M5 30-bps AMM and LP math, using exact atomic BigInt arithmetic and minimum LP protection.
- Remove: native M6 remove_liquidity(ownedShares, minBase, minAMA, expiryEntryHeight), with **no Coin attachments**. Caller must own every burned LP share. Emergency withdrawals remain allowed while paused.
- Deadlines are native entry heights, not browser clock. Constructed previews must expire within 500 blocks and carry the exact intended method, caller, contract address, attached symbols, amounts and min-output constraints.
- All transaction intents explicitly say walletApprovalRequired=true and broadcastEnabled=false.

**CRITICAL wallet limitation:** The official currently documented injected Amadeus wallet signTransaction({contract, method, args, description}) does NOT expose an attachment argument. Calling it directly for M6 pool deposits would sign a zero-Coin-attached transaction. Therefore M7 never calls signTransaction for liquidity, never requests signatures on an incomplete payload, and never submits. A future officially verified extension/API with native attachment signing **plus verified testnet-network attestation** is required. The function requireDocumentedLiquiditySigningCapability deliberately throws until such acceptance is complete.

## On-chain finalized receipt validation (prepared, not exercised live)

Source: lib/liquidity/receipt.ts.

For any future user-approved real deposit or withdrawal transaction, query sdk.transaction.get(txHash), and require the signed hash, exact wallet signer, expected deployed contract, native method and arguments, a successful receipt, and *finalized* ledger metadata. Compare independently read, internally reconciled before/after native reserve and LP snapshots for exact deltas and unchanged pause status. An unsigned preview, wallet approval, tx hash, or a mock transaction is NOT confirmation.

Negative tests include mismatched actions, reverted and unfinalized receipts, stale reserve reads, unsafe Coin.flat precision, custody mismatch, spoofed owner and unowned LP.

## Test commands

- npm run typecheck
- npm test
- npm run build
- cargo test --manifest-path contracts/amadeus-riscv/math/Cargo.toml --offline
- cargo test --manifest-path contracts/amadeus-riscv/pools/Cargo.toml --lib --offline
- GitHub CI also rebuilds both native RISC-V ELF guests and probes testnet RPC/token registration read-only.

A passing mock suite proves deterministic application logic **only**, not two wallet witnesses, actual pool ledger state, a signed add/remove liquidity operation, native wallet attachment support, or an authenticated deployed pair.

## Live acceptance blockers — KEEP issue #7 OPEN

- [ ] M3 issue #3: two independent native wallet witnesses and authoritative signing-network check.
- [ ] M4 issue #4: real finalized TESTBTC and TESTUSD native Coin issuance and verified issuer balances.
- [ ] M6 issue #6: both live pool addresses, ELF identity hashes, initialization security against first-caller takeover, VM execution/rollback/gas acceptance and finalized deployment receipts.
- [ ] Wallet extension must demonstrably sign native attached Coin transfers and support verifiable testnet-domain approval. No private key collection or unattended submissions.
- [ ] Two independently witnessed AMA/base deposits with finalized transaction hashes, actual contract native Coin custody matching reserves, and LP credits.
- [ ] Two independently witnessed owner LP withdrawals with finalized transaction hashes, corresponding native Coin payouts and reserve/share reductions.
- [ ] Reconfirm fail-closed zero liquidity and paused/emergency-exit behaviour on the **real** Amadeus testnet runtime.

Until these are met: **no live deposits, swaps, price charts, liquidity balances, fake metrics or running market maker.** M8 spot buy/sell code may be planned in isolation without claiming active trading.
