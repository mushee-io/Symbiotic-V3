# AMA Spot — first Amadeus testnet milestone

Source: `mushee-io/Symbiotic-v2` (Cardano Preprod, Aiken). This branch is an **isolated adaptation prototype**, not a replacement for the original Symbiotic deployment.

## V1 product boundary

- Spot only: two proposed native test assets `TESTBTC` and `TESTUSD`, paired as `TESTBTC/AMA` and `TESTUSD/AMA`.
- Perpetuals, RWA and Notional: visible as **Coming Soon**, with no working trade buttons.
- Amadeus injected wallet via `window.amadeus.requestAccounts()`. Never request seed phrases or private keys.
- Live, server-side Amadeus testnet RPC health check at `/api/amadeus/status`.
- No fabricated prices, balances, liquidity, activity or trades.
- Market maker: planned, not deployed. Any later bot must execute wallet-authorized, risk-limited, auditable testnet trades; posting self-matched or wash volume is prohibited.

## Actual chain work still required

1. Finalize test asset names (symbols may be reserved or conflict with existing testnet assets). Mint both **on Amadeus Testnet**, capture token identifiers and independently verifiable transaction receipts.
2. Build/audit/deploy an Amadeus **RISC-V Rust** spot exchange contract (constant-product AMM or audited alternative). Cardano Plutus/Aiken scripts cannot be redeployed directly. Require explicit pool reserves, fee maths, slippage bounds, ownership and withdrawal safety.
3. Seed real TESTBTC/AMA and TESTUSD/AMA testnet pool liquidity with funded, authorized wallet signatures. Never display simulated reserves as on-chain liquidity.
4. Implement typed wallet signing with network selection and exact wallet-approved swap calls. Verify transaction results at the chain endpoint before recording fills. A submission timeout alone is not finality.
5. Index confirmed swap receipts into chart, quote, market balances and trading history; fail closed when no receipts.
6. Run a single dedicated testnet market-making wallet with strict inventory limits, spread bounds, minimum notional and emergency stop; distinguish quotes from confirmed fills. Never run 24/7 bots from request handlers or Vercel cron without agreed controls.
7. Test real bidirectional swaps end-to-end on testnet with independent explorer evidence before claiming a live spot DEX.

## Official integration sources

- Chain: https://github.com/amadeusprotocol/node/blob/main/DOCS.md
- RISC-V contracts: https://github.com/amadeusprotocol/node/blob/main/contract_samples/GETTINGSTARTED.md
- SDK: https://github.com/amadeusprotocol/amadeus-typescript-sdk
- Wallet integration: https://docs.ama.one/wallet/creating-a-wallet/chrome-extension-wallet/10.-integration-guide
- RPC: `https://testnet-rpc.ama.one`
- Faucet: https://mcp.ama.one/testnet-faucet

## Build and test

Run `npm install`, `npm run typecheck`, `npm test`, `npm run build`, then visit `/amadeus`.

**Release status:** Wallet connect + UI + testnet health are code-level features only. Token creation, pool deployment, swaps and bots have **not** been executed or independently verified on Amadeus Testnet. Do not pitch V1 as on-chain trading complete until receipts exist.
