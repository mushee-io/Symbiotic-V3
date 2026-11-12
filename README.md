# Symbiotic V3 — AI Spot Trading on Amadeus

**Symbiotic V3 is an Amadeus-native AI trading platform.** This version runs exclusively on **Amadeus public testnet** while the spot exchange is built and verified. The imported chain-specific application was replaced with a clean native Amadeus starter.

## Trading scope

- **Spot trading first:** the initial testnet markets are `TESTBTC / AMA` and `TESTUSD / AMA`.
- **AMA-only quote currency:** every token launched or listed by Symbiotic V3 will pair against native **AMA**. No alternative quote tokens or cross-chain settlement in the MVP.
- **AI liquidity and execution tools:** an AI-powered market-making agent is planned for M10, **not yet operational**. It will use real pool liquidity, strict operator-defined risk limits and verifiable transactions. No artificial trading volume.
- **Future markets:** Perpetuals, RWA, Notional and Options are **Coming Soon** and cannot execute orders.
- **Smart contracts:** native Amadeus WASM contract integration; this project does not use an imported foreign-chain execution environment.

## Present implementation

This is currently a **spot interface with native testnet RPC health and read-only AMA wallet balance support**, **not a working exchange**. Token issuance **planning, registry reads and a wallet-approved mint flow** are implemented in M4, but no live mint receipt has been verified. Liquidity pools, spot swaps and AI agent execution require later milestones and independently verified testnet receipts. Inactive controls stay disabled.

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
- Testnet explorer: https://testnet-ama.ddns.net
- Client SDK: `@amadeus-protocol/sdk`
- Network check API: `/api/network` (reads the real chain tip or fails closed)
- The application must never fall back to mainnet when testnet is unavailable.

## Milestone-by-milestone development

See the [12 detailed milestones](docs/roadmap.md) and [M1–M12 GitHub tracking issues](https://github.com/mushee-io/Symbiotic-V3/issues). Each milestone requires its own acceptance evidence. Source-code completion alone is not a claim of a functioning on-chain swap.

**M1:** Amadeus-only repository extraction, branding, and CI.  
**M2:** Verify native testnet connectivity and runtime failure modes.  
**M3:** Native extension discovery, opt-in account connection, local disconnect and live AMA testnet balance reads are implemented; the two-wallet witness and network-attestation gate remain pending. See [M3 wallet guide](docs/m3-native-wallet.md).  
**M4:** Two strictly AMA-quoted test token definitions, read-only Coin registry, wallet-approved transaction construction and finalized mint verification (live mint witness pending). [M4 issuance guide](docs/m4-native-tokens.md).  
**M5–M9:** Native AMM, pools, real liquidity and spot trading.  
**M10–M12:** Guardrailed AI market making, security and public testnet demo.

## Sources

- [Amadeus node documentation](https://github.com/amadeusprotocol/node/blob/main/DOCS.md)
- [Amadeus SDK](https://github.com/amadeusprotocol/amadeus-typescript-sdk)
