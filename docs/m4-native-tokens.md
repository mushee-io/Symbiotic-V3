# Milestone 4 — native Coin token issuance on Amadeus Testnet

Tracking issue: https://github.com/mushee-io/Symbiotic-V3/issues/4

## Exact initial asset scope

The only proposed test assets are **TESTBTC/AMA** and **TESTUSD/AMA**. AMA is the only spot quote asset. Native Coin symbols are **chain-global names, not ERC-20 contract addresses**. No new markets are active.

| Asset | Native symbol | Initial units | Decimals | Initial atomic units | Mintable after creation | Pausable | Soulbound |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Test Bitcoin | TESTBTC | 1,000,000 | 9 | 1000000000000000 | false | false | false |
| Test Dollar | TESTUSD | 1,000,000 | 9 | 1000000000000000 | false | false | false |

These are engineering defaults, not an agreed economic mainnet token supply. Supply is fixed for this MVP test run. The chain's native Coin implementation uses nine-decimal base units; the call accepts 0–9 decimals, but creation does not persist a separate precision metadata record. Record the 9-decimal convention and the exact call in evidence.

## Verified implementation basis

The Amadeus node's native Coin contract accepts six positional parameters for create_and_mint:

1. symbol string (TESTBTC or TESTUSD)
2. supply as a **decimal string of atomic units** (1000000000000000)
3. decimals ("9")
4. mintable ("false")
5. pausable ("false")
6. soulbound ("false")

The creator is added to the symbol's native issuance permission list. This does not override globally reserved symbols, existing symbols, collection-symbol collisions or a separate wallet's lack of signing authority; the **chain** makes the authoritative decision.

Code validates the symbol allowlist, permitted pair, fixed supply/precision, native numeric bounds and six-argument call. Symbol status is read from the native state key coin:<SYMBOL>:totalSupply using the pinned SDK. An explicit null means no Coin registration key at the time of checking. Any unknown, erroneous or malformed response fails closed; unregistered is **not a guarantee that the chain will approve issuance**.

## Wallet-approved signing and verification

1. User connects the official Amadeus wallet extension with explicit account permission.
2. The app verifies that the native testnet RPC is healthy and the wallet itself reports testnet as signing network. RPC reachability is NOT wallet network attestation.
3. Only when verified and the symbol currently has no Coin entry, a human clicks Approve & Mint.
4. The provider signs the exact Coin.create_and_mint call and returns packed bytes; the app **never handles mnemonic/private keys**.
5. The app submits the signed transaction **once** to the pinned public Amadeus testnet SDK with submitAndWait(..., { finalized: true }); no mainnet fallback or unconditional retry.
6. Check the signed/returned hash, successful execution receipt, finalized transaction metadata, Coin function and signer, exact on-chain total supply and the issuer's token balance before displaying a verified mint.
7. On RPC failure, ambiguous timeout, declined approval, symbol collision or reverted execution, report **not verified**. A signed hash is not proof that a mint happened.

**Current limitation:** The documented Amadeus injected wallet API does not currently expose a trustworthy network query. An optional newer provider network method is supported if it reports exact testnet, but the app cannot assume that it exists. Signing is blocked when the wallet network cannot be verified. No unattended minting, stored secrets or automatic transactions are implemented.

## Test commands and acceptance

- npm run typecheck
- npm test
- npm run build
- npm run testnet:check
- npm run tokens:check

The read-only tokens:check script inspects existing public Coin registration. It does not issue tokens or prove mint receipts. A nonblocking CI smoke step may be unavailable when the public RPC is down. CI mocks test validation, state detection, forced no-mainnet-fallback, user approval, invalid signing payloads, finality, failure handling and issuance permission assumptions; **they are not live transactions**.

Close issue #4 only after collecting real testnet records for **both** newly issued symbols: issuer public address, exact call and supply, signed transaction hashes, successful **finalized** execution receipts, actual native Coin state, corresponding public wallet balances and proof that each token was paired only with AMA in the planned markets. If a globally claimed symbol or unsupported wallet blocks this acceptance, leave the issue open and record that blocker; don't falsely mark tokens minted.

M3's outstanding two-real-wallet witness and signing-network attestation remain open independently. No spot swap or liquidity pool is activated before M5–M8.
