# M6 — Amadeus Native RISC-V Pool Contracts

Tracking issue: https://github.com/mushee-io/Symbiotic-V3/issues/6

## Build status (not deployment)

CI compiles exactly two distinct native RISC-V ELF guests:

- testbtc-ama.elf, feature testbtc for TESTBTC/AMA
- testusd-ama.elf, feature testusd for TESTUSD/AMA

AMA is the only quote asset. The compiled guests use the official Amadeus RV64IM + Zba/Zbb target specification. CI checks ELF magic, machine type, size ≤512 KiB and distinct SHA-256 digests; downloadable artifacts are unsigned program bytes, not on-chain deployments.

There are **no verified live pool addresses, deployment receipts, token mint receipts, liquidity reserves, or executed swaps**. Issues #3 and #4 remain open. Spot trade buttons remain disabled.

## Contract implementation and native ABI

Source code: contracts/amadeus-riscv/pools/examples/pool.rs with a minimal original native syscall wrapper in contracts/amadeus-riscv/pools/src/lib.rs; imports the existing no_std Rust AMM math crate from M5. Not Solidity/EVM.

Methods and required native attachments:

| Method | Arguments | Coin attachments | Effect |
| --- | --- | --- | --- |
| init | none | exactly native base and AMA | Sets first caller as admin, initial reserves, 1,000 permanently locked LP shares and creator shares |
| add_liquidity | min LP, deadline height | base and AMA | Credits proportional LP shares, refunds excess native Coin inputs |
| remove_liquidity | shares, min base, min AMA, deadline | none | Caller-owned LP burn, two native Coin payouts, permitted during pause |
| swap_exact_in | min output, deadline | exactly one base Coin or AMA | 30 bps fee, constant-product quote, strict slippage, return opposite native Coin |
| pause / unpause | none | none | Admin-only trading/deposit pause, not LP withdrawal |
| get_reserves | none | none | Stored atomic base, AMA, total LP, paused bit; not market data or live custody proof |
| get_lp | none | none | LP shares held by chain-provided caller |
| get_base | none | none | Immutable compile-time base symbol |

Storage is contract-scoped and includes initialized, immutable admin, base reserve, AMA reserve, total LP, individual LP balances under raw 48-byte account keys, pause flag, and transient reentrancy guard. The first 1,000 LP shares are locked permanently. All math uses 9-decimal atomic Coin amounts, checked signed-i128-compatible products and a conservative 10^16 atomic reserve cap.

The native syscall adapter decodes canonical vecpak Coin attachment maps; rejects malformed bytes, unexpected symbols, duplicate symbols, NFTs, invalid amounts, overflow and unexpected attachments. Nested outgoing Coin transfers use the built-in contract call. State changes precede nested transfers and are guarded against reentrant calls. Chain abort/rollback atomicity must still be independently tested on the real native runtime.

Deadlines use native ENTRY_HEIGHT. Admin and LP ownership use the chain ACCOUNT_CALLER, not a browser-supplied address. The same guest is compiled under two mutually exclusive base features; no third base or quote is configurable.

## Tests and reproducibility

Run from repository root:

1. cargo test --manifest-path contracts/amadeus-riscv/math/Cargo.toml --offline
2. cargo test --manifest-path contracts/amadeus-riscv/pools/Cargo.toml --lib --offline
3. bash contracts/amadeus-riscv/pools/build.sh
4. npm run typecheck && npm test && npm run build

Native compiler requires nightly Rust with rust-src, a supported RISC-V backend and readelf. GitHub CI runs all tests, compiles both optimized ELF guests, checks architecture and size, computes hashes and uploads the unsigned files as an artifact.

**Host tests, bytecode verification and a successful compiler are not end-to-end native VM execution tests.** Current code is a testnet deployment candidate, not a security-audited or chain-validated contract.

## Prerequisites before broadcast or closing issue #6

1. M3: Two independent real Amadeus wallets and reliable signing network attestation. The documented wallet provider has no guaranteed getNetwork API.
2. M4: Both TESTBTC and TESTUSD must be minted via individually authorized real testnet transactions; verify native Coin states, actual supplies, issuer balances and finalized receipts.
3. Initialization safety: The first successful initializer becomes admin. Deployment and initialization must be atomic and deployer-authorized, or a signed immutable admin must be bound to the binary. Otherwise another wallet could initialize an uninitialized pool. **Do not deploy until this has been addressed.**
4. Native VM runtime execution: Validate caller identity, Coin attachments and transfers, abort atomicity, reentrancy guard, deadlines, native storage/gas charges, deposit refund, pause/emergency withdrawal and reserve-to-actual-custody reconciliation.
5. Separate finalized deployment receipts, publicly visible contract identifiers/addresses and bytecode hashes must be recorded for both pairs; none exist as of this milestone run.
6. M7: Real reserves and LP funding must be witnessed. M8: Four actual bidirectional swap scenarios with ledger receipts before activating spot trading.

Do not claim these binaries are deployed, initialized, funded, audited or executable on a public chain until actual on-chain evidence is obtained.

Official specifications:
- https://github.com/amadeusprotocol/node/blob/main/contract_samples/riscv/README.md
- https://github.com/amadeusprotocol/node/blob/main/contract_samples/riscv/examples/deposit.rs
- https://github.com/amadeusprotocol/node/blob/main/ex/native/rdb/src/consensus/riscv/host.rs
