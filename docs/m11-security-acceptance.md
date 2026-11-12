# M11 — Amadeus native security and CI acceptance evidence

Tracker: https://github.com/mushee-io/Symbiotic-V3/issues/11

## Outcome: source and host-test hardening, NOT an independent chain audit

Scope: TESTBTC/AMA and TESTUSD/AMA ONLY; AMA is the single quote and network gas asset. Real wallet signing, token issuance, pool initialization, liquidity, swaps and automated market-making remain disabled. Successful local/CI tests cannot certify native VM runtime behavior or a live market.

## Findings and remediation matrix

| Finding | Severity | Code-level change / deterministic checks | Outstanding live acceptance |
| --- | --- | --- | --- |
| First caller could initialize an unbound pool as administrator | High | Native guest now uses compile-time approved 48-byte initializer and aborts if public build is unbound (all-zero). Rust wrong-account and zero-admin tests. Public CI binaries cannot initialize. | Bind verified deployer public account in reviewed build, confirm immutable ELF identity, deploy and test unauthorized init on actual native chain. |
| Excessively future-dated or replayable actions | High | Native guest and client restrict height-based deadlines to 20 blocks ahead. Rust and TypeScript tests cover expired/overlong/overflow deadlines. | Real chain height/timeout verification. |
| LP receipt could be reported successful without proof of actual attached Coins | High | LP receipt verifier now rejects absent, duplicate, forged or mismatched chain-recorded Coin attachments; requires native 32-byte hash and independently rooted block height. | Independently confirm canonical native attachment field format against final transaction receipts; no real deposits yet. |
| Swap finality trusted transaction status without independent rooted-height witness | High | Requires independently rooted height and canonical native hash in addition to previous exact signer, pool, method, attachment and before/after reserve/Coin/LP checks. | End-to-end finality and rollback on real network. |
| Native Coin transfer/reentrancy failure | High | Exact native built-in CALL acknowledgement check and storage guard around external calls; Rust guard/ack tests and CI static checks. | Actual failed Coin.transfer, nested reentrancy, storage journal rollback, gas/memory and call-depth drills on Amadeus RISC-V VM. |
| Fee/LP rounding, dust, integer over/underflow and reserve depletion | High | Rust x*y=k invariants, locked LP, min-out and 4,000 seeded native arithmetic adversarial cases; JS deterministic scenario tests. | Live contract transitions and chain-state reserve-to-Coin custody proof. |
| Unverified wallet signing-domain and token-mint bypass | High | Native 48-byte public key validation, default-deny M3 signing readiness, fail-closed user rejection, mint signer/broadcast blocked until separate M3 evidence; negative tests. | Two real wallet testnet witnesses, attachment-aware wallet API and genuine TESTBTC/TESTUSD mint receipts. |
| Fake operator approval, compromised oracle, false PnL, kill-switch bypass | High | Read-only M10 HOLD policy without independently certified source, spoofed request parameters rejected, no signing/broadcast route. Pause/kill are only browser preview controls, not durable production backend controls. | Verified oracle, daily PnL, persistent authenticated approval/kill control and operator-audited testnet trading drills. |
| Stale RPC, changing reserves and frontrunning/slippage | Medium | Read-only custody-reserve rechecks, quote expiry and slippage rejects, native pinned testnet only, negative tests for paused/missing pools and invalid proofs. | Real native testnet ordering, reverted and delayed transaction tests. |

## What the CI evidence does and does not demonstrate

The GitHub workflow has three required jobs:

1. amadeus-only: strict branding, TypeScript type checks, all prior and M11 test suites, native AMM Rust maths tests and native host ABI security tests, Next.js production build, and **nonblocking read-only public testnet observations**.
2. riscv-elf: two distinct native RISC-V ELF binaries compiled under the official Amadeus native target, their headers/architecture/size checked, hashes emitted, and unsigned artifacts uploaded. The CI ELF builds are intentionally uninitialized/inert; there are no deployer accounts, tokens or funds.
3. m11-security: static-source security invariants and a versioned JSON artifact named m11-static-security-evidence, with SHA-256 digest. Explicit fields productionReleaseAuthorized:false, nativeVmRuntimeTested:false, liveTokenMintsVerified:false, realLiquidityVerified:false, liveSwapReceiptsVerified:false, twoWalletSignaturesVerified:false and externalSecurityAuditCompleted:false are mandatory.

The security source report is **not** a penetration test, external audit, gas proof, native VM rollback test, receipt, transaction or successful deployed-contract test. The mock transaction and deterministic failure-drill tests are not independently observed blockchain outcomes.

Tests must include forged LP/native Coin attachments, incorrect signer and public key, first-initializer takeover, host transfer acknowledgement, storage reentrancy, integer cap/LP conservation, slippage and expired height, tx rollback uncertainty, wallet rejection, compromised price reference, daily loss cap, kill-switch and spurious operator approval, RPC outage and rooted-finality mismatch. No synthetic volume or actual fund transfers are authorized.

## Remaining go/no-go acceptance

- Issues #3, #4, #6, #7, #8, #9 and #10 remain OPEN: two independent wallets and signing domain; two genuine native test assets; two actual initialized pool contracts; signed funded LP deposits/withdrawals; real bidirectional BUY and SELL on both pairs; real terminal/history; independent source, risk, operator approval and auditable market-making proof.
- Explicitly bind native initializer identity to the verified deployer and reproduce two signed ELF/deployment receipts before any initial pool funding.
- Validate real native Coin attachment serialization, built-in transfer return, failure rollback and attempted reentrancy on actual native VM; host mocks alone do not prove the transaction is atomic.
- Validate gas and storage bounds and record actual finality/rooted-chain witnesses for each authorized action.
- Obtain independent security review and document remediation before calling the contract production safe.
- Do not enable trading or pretend to pass tests not actually executed on the chain.

**M11 implementation can be merged after passing CI, but issue #11 must remain OPEN until real on-chain security and acceptance gates are satisfied.**

M12 should package evidenced acceptance, incident and deployment readiness and MUST NOT remove security locks or assert live exchange readiness without those proofs.
