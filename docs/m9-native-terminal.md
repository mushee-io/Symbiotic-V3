# Milestone 9 — Amadeus-native spot terminal, verified data only

Issue: https://github.com/mushee-io/Symbiotic-V3/issues/9

## Strict AMA scope and release status

M9 adds the actual read-only terminal interface and backend data verification. **It does not create or display fake pools, token holdings, prices, swap fills, transaction history, charts or market volume.** No wallet signing or broadcast path has been enabled.

The only two selectable spot markets are **TESTBTC/AMA** and **TESTUSD/AMA**; AMA remains the single quote asset. Neither test token has a finalized live issuance witness in existing milestone evidence. Pool certificates are still deliberately NULL in lib/liquidity/deployments.ts.

## Native testnet read-only terminal API

GET /api/terminal/status?base=TESTBTC&owner=PUBLIC_48_BYTE_BASE58_ADDRESS is read-only. The optional owner is a connected public Amadeus account and is never a private key.

1. Explicitly pin SDK to https://testnet-rpc.ama.one/api. Reject any mainnet, alternate or missing/invalid RPC configuration and malformed public accounts/markets.
2. Independently inspect native chain tip, statistics and rooted height. A healthy RPC does NOT certify exchange readiness.
3. Inspect native Coin global supply registration for the chosen TESTBTC or TESTUSD symbol. Unregistered is not represented as a wallet balance of zero. A registered symbol is described as chain-registered, not proof of our intended M4 issuance or legitimate ownership.
4. For connected wallet, read real native AMA Coin holdings with wallet.getBalance. Read selected base Coin only when the native registry confirms the symbol exists; use exact integer atomic units and reject unsafe SDK Coin.flat precision. Never show speculative USD value, portfolio PnL, volume or token price.
5. For a **reviewed/certified** pool only (both certificates remain null), read real native get_base, get_reserves, optional owner get_lp, and actual native Coin custody. Re-read reserves and require exact reserve-to-Coin balance equality. Paused/empty/unavailable pools never become active quotes.
6. Only for a certified pool and connected public account, query SDK chain.getByFilter with exact signer, pool contract_b58 and function swap_exact_in, sort desc and limit 20. Re-fetch each candidate via transaction.get(hash), require successful finalized execution, exact signer/pool/method, explicit single AMA or base attachment/amount, sane positive minimum output and deadline, and entry height <= rooted chain height. Duplicates, missing hashes, mismatches or backend errors fail closed. The result is explicitly a **finalized swap contract call**, NOT proof of independently reconciled output or fill size.
7. The existing M8 /api/spot/quote supports display-only reserve-backed BigInt quotes. It uses 30-bps AMM fee, 1–500-bps user slippage, exact native reserve checks and never enables a broadcast button.

API failures return HTTP 503 with market:null and tradingEnabled:false. No real pool certificate yields status blocked, pool:null and history:null; history is not the same as a confirmed empty successful query. If a certified pool returns a genuine empty transaction page, history is [] and the UI explicitly says no verified finalized calls were found. Both outcomes contain no invented transactions.

## Explorer and charts

Explorer links are derived exclusively from validated native Base58 transaction hash (32 decoded bytes) or account address (48 decoded bytes), using the official Amadeus SDK testnet explorer origin at https://testnet.explorer.ama.one/network/tx/HASH and /network/address/ADDRESS. They never point to mainnet.

A successful historical transaction call lacks independently replayed reserve/wallet snapshot proof for actual output; the terminal only displays the native input amount, caller-signed minimum output and finalized block height. It **does not** infer output, rate, volume, candle, price movement or AI trading activity from transaction count, fee logs or wallet nonce.

There is no authenticated archival reserve-price series available today, so the chart is intentionally **null**, and an explanatory empty state is shown. Never generate artificial candles, chart prices, TVL, order books or volume. A later chart requires actual historical rooted on-chain reserve observations, auditable heights/timestamps and custody verification, not linear interpolation or mocks.

## UI architecture

- Homepage market selector is the one source of truth for the main full-width terminal (TESTBTC/AMA, TESTUSD/AMA).
- Wallet component reports only the approved public account through an optional callback. Disconnect or changing account clears balances, history and quotes; no private keys or background signing.
- Terminal shows real-only pool reserves, token status, native AMA and optional base balances, terminal-specific BUY/SELL read-only quote inputs, minimum output, and finalized historical calls if and only if verified.
- Missing data display em dashes and an explicit empty/error state, never placeholder zero prices.
- Quote requests are invalidated on market, account, amount, slippage and direction changes to avoid stale network responses reappearing; no trading execution control is enabled.
- Mobile layouts stack metric cards, form fields and history rows; page controls have labels and focusable anchors.

## Test and CI evidence

New automated tests cover invalid Base58 explorer links, two AMA markets, live AMA/native token registration behavior, lack of token = NULL rather than fake zero, absence of deployed pools, strict signer/contract/function filtering, canonical requery and finalized-height checks, forged/corrupt/mismatched receipt/attachments, duplicate hashes, RPC outage, no mainnet fallback, and no chart fabrication. Existing M1–M8 test suites and both no_std Rust suites remain required.

Commands: npm run typecheck; npm test; npm run build; cargo test --manifest-path contracts/amadeus-riscv/math/Cargo.toml --offline; cargo test --manifest-path contracts/amadeus-riscv/pools/Cargo.toml --lib --offline. CI also builds both native RV64ELF guests and reads the official public testnet status and native Coin symbols WITHOUT minting.

**Native runtime acceptance, real deployed pools and actual two-wallet swaps have NOT been independently verified. Passing mocks/CI are not evidence of live exchange functionality.** M3, M4, M6, M7 and M8 issues remain open. M9 may close only when the two-wallet genuine balance, reserve-backed quote, finalized historical swap and explorer checks pass against publicly verifiable native chain data for both pairs. Before that, keep M9 OPEN.

M10 AI work must remain preview/planning only until the real spot exchange is functional and independently witnessed. No automated market making can operate against fabricated or unverified liquidity.
