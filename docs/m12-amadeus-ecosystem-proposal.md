# Amadeus ecosystem proposal — Symbiotic V3 + 33JACK

**Prepared 12 November 2026 | Discussion draft, not an accepted grant application, awarded funding, or certification.**

## Proposal summary

Mushee proposes two complementary but independently governed Amadeus-native product initiatives:

**Symbiotic V3** — a native AMA-quoted spot exchange research stack. Its proposed initial markets are strictly **TESTBTC/AMA** and **TESTUSD/AMA**, with AMA the sole quote and fee asset. The current codebase includes native RISC-V pool guests, deterministic constant-product math, a read-only two-market terminal, native Coin monitoring, explicit signing safety barriers and nonexecuting AI-assisted inventory/risk decisions.

**33JACK** — a separate AI-assisted cross-border business-payment and invoicing initiative. The product direction includes invoice intake, email-driven workflows, automated payment preparation and cross-border reconciliation. A future Amadeus integration may use native transactions and AMA settlement where appropriate. **This proposal does not assert that 33JACK currently executes verified payments on Amadeus, has a live Symbiotic integration, holds a particular financial-services license or has audited volume.** Any regulatory authorizations and live-transaction claims require separate documentation.

The proposed long-term relationship is a **complementary ecosystem pathway**, not a proven shared liquidity bridge. 33JACK could help businesses discover native payment rails and treasury use cases; Symbiotic V3 could offer separately governed AMA-native price-discovery and spot liquidity infrastructure after independent launch acceptance. No automated cross-product transfer or treasury execution is enabled today.

## Problem and ecosystem opportunity

Builder ecosystems need transparent experimental liquidity rails, reliable on-chain proof of transactions, and accessible business payment experiences. The technical challenge is not simply publishing a trading terminal: native Coin custody, operator signing, contract VM failure behavior, reliable price sources, deposit and withdrawal accounting, and trustworthy transaction finality all need verifiable acceptance.

Symbiotic V3 addresses the development and verification layers of native AMA spot infrastructure. 33JACK explores payment workflow accessibility and agent-assisted back-office automation. Each initiative would be evaluated independently for security, user value, risk and regulatory requirements.

## Current engineering status — no overstated traction

| Component | Source engineering | Public chain acceptance |
| --- | --- | --- |
| AMA-only network and SDK | Built, tested, GitHub M1/M2 issues closed | Native RPC reads possible; connectivity is not swap proof |
| Constant-product AMM math | Implemented and host-tested, M5 closed | Contract runtime and economic acceptance pending |
| Native test Coin creation | Exact TESTBTC and TESTUSD definitions; mint verification code | Live final mint receipts not verified |
| Native RISC-V pool guests | Two compile-time-specific ELF builds and host security gates | Neither native pool deployed/initialized with certified receipt |
| Liquidity/LP functions | Source checks and reconciler/receipt verifier | No confirmed funded pools or real LP transactions |
| BUY/SELL | Reserve-backed exact-input quote and receipt-verifier code | Four finalized live swap receipts missing |
| Terminal and historical data | Read-only UI; no fabricated charts | No genuine settled fills or archival price series |
| AI-assisted risk research | Deterministic spread, inventory, gas and daily-loss policy | No autonomous trading, oracle proof or production operator approval |
| Security evidence | CI, adversarial tests, static source report, Rust host tests | Native VM runtime security and external audit missing |
| Public web demo | /demo page and testnet readiness endpoint in source | Vercel public production deployment not independently verified |

At time of preparation, the public read-only token registry check has not shown verified issuance of either test symbol. Symbiotic V3 is **not a functioning live spot exchange** and claims no users, total value locked, token price, trading volume, revenue or grant award.

## Proposed work packages and independent acceptance

**Work package A — Native wallet and Coin issuance.** Work with Amadeus wallet/SDK maintainers on authoritative testnet signing-domain and attached-Coin approval. Verify two independent wallet sessions and finalized TESTBTC/TESTUSD issuance, issuer supply/ownership and no-mainnet-fallback.

**Work package B — Native RISC-V audited pools.** Independently confirm the Amadeus VM host ABI, transfer atomicity and rollback. Bind a reviewed deployer public account to the previously inert ELF builds; deploy and initialize two AMA-quoted pools with explorer-linked contract/bytecode receipts. Add third-party security review and negative runtime drills.

**Work package C — Liquidity and real spot acceptance.** Execute approved testnet deposits/withdrawals; reconcile actual native balances, reserves and LP accounting. Verify four genuine BUY/SELL transactions across two pairs, including native receipt finality, attached Coin movement and user balance delta.

**Work package D — Public demonstration and evidence.** Verify an actual public hosting deployment, matching commit SHA, route availability, testnet health, wallet approvals, transaction explorer links and tamper-evident public acceptance records. Do not include synthetic charts or fake market statistics.

**Work package E — Independent payments research.** Assess 33JACK's potential native Amadeus settlement and invoice reconciliation pathway, subject to separate compliance, security, user consent and project review. No automatic transfer between platforms without a distinct security and product authorization.

**Work package F — AI risk controls and governance.** Validate independent price references and daily realized PnL before considering a guarded testnet operator with durable permissions, limits, pause/kill behavior and explicit wallet-approved actions. Prevent wash trading and self-trading.

Each work package is milestone-gated. A failed gate pauses subsequent deployment/financial actions rather than being interpreted as success.

## Requested ecosystem support

We request consideration for **technical integration support**, native wallet and VM mentorship, testnet and indexing infrastructure, security review/audit credits, ecosystem introductions and a **milestone-based development grant**. Budget and funding size should be scoped with the program, not misrepresented as approved.

Illustrative allocation of a future *negotiated* grant budget: 30% protocol/contract engineering, 25% independent security validation, 20% wallet and testnet acceptance, 15% public evidence/developer experience, and 10% payment-workflow research. These are proposal percentages, **not actual spend, award terms or commitments from the ecosystem**.

## Publicly inspectable evidence

- [Symbiotic V3 source](https://github.com/mushee-io/Symbiotic-V3)
- [12 milestone issues](https://github.com/mushee-io/Symbiotic-V3/issues)
- [GitHub CI source, logs and artifacts](https://github.com/mushee-io/Symbiotic-V3/actions)
- [Native testnet explorer](https://testnet.explorer.ama.one)
- [M12 readiness and demonstration guide](m12-public-testnet-demo.md)
- [M11 security findings, caveats and pending acceptance](m11-security-acceptance.md)

All URLs here are navigational; their existence does not prove an actual 33JACK integration, live Symbiotic pool or grant acceptance. A public Symbiotic V3 hosting URL will be added only after separate Vercel deployment verification.

## Applicant contact and next step

**Proponent:** Mushee — Symbiotic V3 and 33JACK initiatives.

We would welcome feedback from the Amadeus ecosystem team on native Coin attachment signing, native contract initialization/custody, available security-review pathways and milestone-based funding. We can share the codebase, negative-test evidence and an independently witnessed public testnet demonstration **once** the outstanding requirements are satisfied.

**No token sale, financial performance promise, licensing representation or investment solicitation is made in this draft.**
