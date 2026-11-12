# Symbiotic V3 — AI Spot Trading on Amadeus

**Symbiotic V3 is an Amadeus-native AI trading platform.** This version runs exclusively on **Amadeus public testnet** while the spot exchange is built and verified. The imported chain-specific application was replaced with a clean native Amadeus starter.

## Trading scope

- **Spot trading first:** the initial testnet markets are `TESTBTC / AMA` and `TESTUSD / AMA`.
- **AMA-only quote currency:** every token launched or listed by Symbiotic V3 will pair against native **AMA**. No alternative quote tokens or cross-chain settlement in the MVP.
- **AI-assisted liquidity research:** M10 adds a deterministic Amadeus-native spot risk and inventory strategy, SHA-256 decision audits and operator-preview pause/kill controls. **There is no live AI model or executing market-making agent.** Independent price/PnL evidence, authenticated operator controls and real spot transactions are mandatory before future activation. No artificial volume.
- **Future markets:** Perpetuals, RWA, Notional and Options are **Coming Soon** and cannot execute orders.
- **Smart contracts:** native Amadeus RISC-V ELF contract integration; this project does not use an imported foreign-chain execution environment.

## Native testnet setup — first real on-chain step

- **Activation wizard:** `/setup` lets a person connect the official Amadeus extension, read an actual AMA testnet balance, visit the official faucet and explicitly approve native TESTBTC or TESTUSD minting if still unregistered. See [Native testnet activation](docs/native-testnet-activation.md).
- **Cryptographic network safety:** the signed transaction is decoded and verified against exact Coin create-and-mint arguments, the selected public account, canonical SHA-256 transaction hash and the official BLS **TESTNET signing domain** before any transaction can reach the pinned testnet RPC. Mainnet signatures and tampering never broadcast.
- **No live proof claimed:** the developer/test suite cannot access or approve the user’s browser extension. Token mints, two-wallet M3 acceptance, pool deployments, funded liquidity and actual swaps remain unverified until real explorer-linked finalized receipts exist. The M3 trading/liquidity signing gate remains closed.

## Homepage and native spot terminal

- **Homepage:** `/` is a distinct public landing page with AMA-only market previews, protocol features and clear launch links. No fabricated prices or trade activity.
- **Trading app:** `/trade` hosts the complete existing exchange-first market watchlist, chart empty state, BUY/SELL read-only ticket, native wallet drawer and verified on-chain activity. Trading remains blocked until the independent live acceptance gates are satisfied.
- **Evidence:** `/demo` remains a dedicated testnet readiness dashboard.

## Public demo and evidence

- Read-only research dashboard: [public testnet demo](/demo) (route available only where the app is actually deployed).
- Public native readiness endpoint: `/api/demo/readiness`; returns live chain and Coin registry reads, dated SHA-256 status digest, specific blocked acceptance gates, and hard `tradingEnabled:false` / `signingEnabled:false`.
- GitHub CI: dedicated `m12-demo` job emits a reproducible SHA-256 source-evidence manifest and non-sensitive M12 grant/demo documentation. **This artifact does not prove a native on-chain event or web deployment.**
- [Amadeus ecosystem proposal](docs/m12-amadeus-ecosystem-proposal.md): separate Symbiotic V3 and 33JACK complementary tracks; any integration, payment licensing and financial activity require their own independent evidence.
- **Public Vercel production hosting has not been verified through the connected account** as of the M12 preparation. Do not publish a demo URL until a real READY deployment, Git commit, hostname and responding HTTPS routes have been checked.
- The [roadmap UI](/roadmap) includes a dated issue-status snapshot. M1/M2/M5 closed; M3/M4/M6–M12 are open until their own acceptance evidence is verified.

## Present implementation

This is a **read-only native testnet trading terminal, not a working exchange**. It queries genuine AMA wallet balances, global token registration, certified native pool reserves, exact-input swap quotes, and individually verified finalized transaction history when evidence exists. There are currently **no certified deployed/funded pools, live swap receipts, historical reserve charts or trade volumes**. M4 native mint implementation has not received real token issuance acceptance. Token issuance can now request a narrowly scoped, user-approved signed testnet mint **only after independent local cryptographic validation**, but no real mints have been verified. M3 two-wallet trading and liquidity signing, spot swaps, and AI agent execution remain disabled until their independent native testnet acceptance gates pass.

## Getting started

Node.js 22 recommended; the official SDK is ESM-only.

```bash
npm install
cp .env.example .env.local
npm run typecheck
npm test
npm run build
npm run dev
```

**Network:** Amadeus native testnet only.

- Testnet RPC: `https://testnet-rpc.ama.one/api`
- Testnet explorer: https://testnet.explorer.ama.one
- Client SDK: `@amadeus-protocol/sdk`
- Network check API: `/api/network` (reads the real chain tip or fails closed)
- The application must never fall back to mainnet when testnet is unavailable.

## Milestone-by-milestone development

See the [12 detailed milestones](docs/roadmap.md) and [M1–M12 GitHub tracking issues](https://github.com/mushee-io/Symbiotic-V3/issues). Each milestone requires its own acceptance evidence. Source-code completion alone is not a claim of a functioning on-chain swap.

**M1:** Amadeus-only repository extraction, branding, and CI.  
**M2:** Verify native testnet connectivity and runtime failure modes.  
**M3:** Native extension discovery, opt-in account connection, local disconnect and live AMA testnet balance reads are implemented; the two-wallet witness and network-attestation gate remain pending. See [M3 wallet guide](docs/m3-native-wallet.md).  
**M4:** Two strictly AMA-quoted test tokens, live Coin registry checks and a **user-approved, independently TESTNET-domain-verified native Coin mint flow** that never broadcasts wrong-network signatures. Signed payloads, receipts, issued supply and issuer balances are checked before claiming finality. **Actual mint witness still pending.** [M4 issuance guide](docs/m4-native-tokens.md) and [activation steps](docs/native-testnet-activation.md).  
**M5:** Deterministic constant-product AMM and a portable native-RISC-V Rust math reference, with two AMA-only pools and locked LP share design. No deployed contracts or live markets. See [M5 AMM architecture](docs/m5-native-amm.md).  
**M6:** Two feature-locked native Amadeus RISC-V ELF pool contracts compile with custody, LP ownership, pause, slippage and reentrancy guards. **No chain deployment, initialization, or runtime execution verified yet**; M3/M4 prerequisites block broadcast. See [M6 native contracts](docs/m6-native-riscv-contracts.md).  
**M7:** Native AMA-only liquidity preparation, unsigned wallet-approval intents, read-only LP/reserve-to-Coin-custody reconciliation and finalized receipt verification code; **no real funding or wallet attachment signing yet**. See [M7 native liquidity](docs/m7-native-liquidity.md).  
**M8:** Native AMA-only BUY/SELL exact-input quotes from independently reconciled reserves, slippage/deadline-safe unsigned Coin attachment intents, a fail-closed spot panel, and finalized receipt/wallet balance verification code. **No live swaps, real pool activity or wallet attached-coin signing verified.** See [M8 native spot](docs/m8-native-spot.md).  
**M9:** Responsive two-market AMA spot terminal with read-only real native wallet balances, token registration, certified reserve/custody status, M8 quote integration, and canonical finalized native swap-call history with testnet explorer links. **Charts, actual fills, volume and trading remain unavailable without independently verified on-chain records.** See [M9 native terminal](docs/m9-native-terminal.md).  
**M10:** Read-only AI-assisted AMA market-making research with strict strategy/inventory/budget/slippage/daily-loss policies, independent-source HOLD gates, default pause/kill controls, deterministic SHA-256 decision envelopes and explicit no-sign/no-broadcast enforcement. **No live autonomous trading or persistent production control service.** See [M10 native agent](docs/m10-native-agent.md).  
**M11:** Security hardening and deterministic failure drills for the two native AMA spot pools, including verified initializer binding gates, 20-block deadlines, rooted native receipt/attachment checks, wallet refusal and policy attack tests, and a static security report in CI. **CI is NOT a native VM security audit, testnet deployment, token mint, or swap receipt.** Live acceptance stays open. See [M11 security matrix](docs/m11-security-acceptance.md).  
**M12:** Public Amadeus testnet readiness dashboard and evidence-linked demo, accurate 12-issue snapshot, grant proposal and reproducible static-source CI manifest. **Public Vercel deployment, independent testnet token mints, funded pools and live swap acceptance are NOT verified.** See [M12 public demo guide](docs/m12-public-testnet-demo.md) and [draft Amadeus ecosystem proposal](docs/m12-amadeus-ecosystem-proposal.md).

## Sources

- [Amadeus node documentation](https://github.com/amadeusprotocol/node/blob/main/DOCS.md)
- [Amadeus SDK](https://github.com/amadeusprotocol/amadeus-typescript-sdk)
