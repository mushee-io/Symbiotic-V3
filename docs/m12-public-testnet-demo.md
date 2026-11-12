# M12 — Public Amadeus testnet demo and verification guide

Public route: /demo (available wherever this commit is actually deployed). Repository: https://github.com/mushee-io/Symbiotic-V3

## Demonstrable scope today

Symbiotic V3 is an Amadeus-native testnet research showcase for exactly **TESTBTC/AMA** and **TESTUSD/AMA**, with **AMA as the sole quote token**. TESTBTC and TESTUSD are experimental names, not claims on BTC or USD.

**Code and read-only features:** responsive landing page, native Amadeus SDK health checks, token registration, wallet public-account connection, real AMA balance querying when available, certified-pool reserve/custody reader, source-checked spot quotes (only with genuine pools), finalized native transaction history (only with real receipts), and a nonexecuting risk engine with decision audit hashes.

**Do not claim:** actual token mints, deployed pools, funded liquidity, live swaps, prices, candles, volume, executing AI, runtime security audit, a verified public deployment or a grant award. Each requires independently witnessed evidence not currently held in this repository.

## Public routes

| Route | What it shows | Gate |
| --- | --- | --- |
| / | Responsive research landing page and two-market terminal | Swaps and signing disabled |
| /demo | Read-only testnet evidence dashboard and readiness matrix | Only server-observed native state |
| /api/demo/readiness | No-store chain observations, blockers and reproducible SHA-256 digest | No query-supplied RPC, pool, wallet, receipts or approvals |
| /api/network | Actual testnet tip and rooted stats, connectivity only | Never implies exchange ready |
| /api/terminal/status?base=TESTBTC | Read-only public market state | Two exact base symbols only |
| /api/agent/monitor?base=TESTBTC | Deterministic risk and HOLD research | No signer, trades or fake PnL |
| /roadmap | Issue-linked 12-milestone progress | Implementation versus live acceptance |

Official explorer: https://testnet.explorer.ama.one. Only link on-chain receipts after confirming their real hashes and independently rooted finality; a network height is NOT an exchange execution receipt.

## Reproducible demo procedure

1. Open /demo and click Refresh on-chain evidence. Confirm the network and record the observed tip/rooted block heights and time. If RPC fails, use the unavailable error state, not a mock result.
2. Inspect both market cards. Record native Coin registry status, with clear distinction between a registered symbol and a verified M4 issuer mint. Absent pools, prices, balances or transaction history stay explicitly unverified.
3. Inspect the live acceptance matrix. Signed trade execution remains disabled while M3–M11 independent prerequisites are outstanding; a successful CI run or SDK connection cannot override it.
4. Open / and switch between the exact TESTBTC/AMA and TESTUSD/AMA markets. The terminal has honest empty histories and no synthetic chart candles or volumes when underlying data is missing.
5. Inspect M10 risk research. Local preview pause/kill controls do not enable a transaction. Its SHA-256 digest describes a reproducible decision, not a trade hash or persistent database audit.
6. Independently inspect [GitHub Actions](https://github.com/mushee-io/Symbiotic-V3/actions), [GitHub issues](https://github.com/mushee-io/Symbiotic-V3/issues) and the Amadeus explorer before presenting proof to users or grant reviewers.
7. Independently verify web hosting. A passing Next.js build and green CI do NOT prove a public READY Vercel deployment; an owned deployment ID, exact commit SHA, public hostname and successful HTTPS response are required.

## Public deployment verification checklist

- [ ] Vercel project linked to mushee-io/Symbiotic-V3 in the correct authenticated team.
- [ ] Public production deployment READY with GitHub commit SHA matching intended main release.
- [ ] Public domain, successful response and functioning /, /demo and /api/demo/readiness on pinned Amadeus testnet.
- [ ] Network-origin and no-mainnet-fallback checked on actual deployed runtime.
- [ ] Capture deployment ID, URL, commit, response status, verification date and evidence hashes. Never invent these values.
- [ ] Public screenshots and a non-sensitive demo video are taken from the real published site, not mock rendering.

GitHub CI generates an m12-public-demo-evidence artifact with commit and static-source checks, not a cloud deployment claim or on-chain witness.

## Prerequisites for a genuine spot trade demonstration — NOT YET DONE

1. **M3:** Two independent native-wallet owners approve testnet-domain signing with authentic Coin attachments. Record wallet rejection and account switching.
2. **M4:** Confirm actual TESTBTC and TESTUSD native Coin mint receipts, issuer Coin balances, correct supply and decimals.
3. **M6:** Review nonzero public initializer binding and authentic RISC-V ELF identity. Deploy and initialize two pools; witness native VM transfer and rollback security.
4. **M7:** Wallet-approved deposits and withdrawals for each pool. Verify native Coin custody equals contract reserves and LP share ownership and lock.
5. **M8:** One finalized BUY and SELL transaction in each market (four receipts total). Reconcile true before/after pool state, trader balances, gas/fees, height, attachment and explorer evidence.
6. **M9:** Witness the two-wallet terminal. Only genuine archival price series may generate chart history.
7. **M10–M11:** Verify external reference prices, authenticated daily PnL, backend operator approval/kill, native VM fault testing and independent security review. No wash trading or artificially generated volume.
8. **M12:** Independently verify live public URL, deployment SHA, user walkthrough, full reproducible witness bundle and honest Amadeus ecosystem proposal.

No private keys, seeds, raw wallet signatures or secrets may be committed or embedded in any evidence bundle.

## Issue status snapshot — 12 November 2026

M1, M2 and M5 have **closed GitHub issues**. M3, M4, M6, M7, M8, M9, M10 and M11 are **open** due to real-chain acceptance. M12 remains open while real swaps and public deployment are not verified. This paragraph is a dated snapshot; always follow GitHub issues for current status.

See [the roadmap](roadmap.md), [M11 security limitations](m11-security-acceptance.md) and [the draft Amadeus ecosystem proposal](m12-amadeus-ecosystem-proposal.md).
