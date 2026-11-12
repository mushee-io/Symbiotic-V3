# Symbiotic V3 — Amadeus Native Spot DEX

Symbiotic V3 is an **Amadeus-native public-testnet project**. This repository replaces the old-chain implementation, while retaining the dark lime/ivory Symbiotic terminal design.

**MVP:** Exactly two test markets, `TESTBTC/AMA` and `TESTUSD/AMA`. AMA is the only quote asset. A V2-style constant-product AMM is a design target to be **built for Amadeus native contracts**, not an already-deployed exchange.

**Coming Soon:** Perpetuals, RWA, Notional, Options. Their trading actions stay disabled.

**Initial status:** UI and RPC scaffolding only; no claim that tokens, pools, real liquidity, swaps, prices or trading volume are active. No fake fills or wash trading.

Run `npm install && npm run dev` locally. For checks run `npm run typecheck && npm test && npm run build`.

Testnet RPC: `https://testnet-rpc.ama.one/api`. Explorer: https://testnet-ama.ddns.net. SDK: `@amadeus-protocol/sdk`.

[12 detailed milestones](docs/roadmap.md). Every blockchain milestone requires verified public testnet transaction receipts before being marked complete.

Official references: https://github.com/amadeusprotocol/node/blob/main/DOCS.md and https://github.com/amadeusprotocol/amadeus-typescript-sdk.
