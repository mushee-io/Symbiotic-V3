# Amadeus public testnet activation — wallet and native test Coin minting

Last prepared: 12 November 2026. GitHub source and deterministic CI can verify *safety code*. They cannot prove a live mint or authorized wallet session until the user approves real transactions in the extension.

## Why a previous M4 mint button remained disabled

The extension's documented injected-provider interface includes `requestAccounts()`, `getAccount()`, `signTransaction()` and events, but **does not include an authoritative `getNetwork()`** method. A wallet-reported network label, if a future extension exposes one, is not sufficient cryptographic evidence.

The official Amadeus SDK does distinguish **MAINNET** and **TESTNET** BLS transaction signatures using different domain separation tags (DST). This implementation checks the signed native VecPak bytes, cryptographic SHA-256 transaction hash, signer identity, exact `Coin.create_and_mint` method, all six fixed arguments, and verifies the BLS signature against the SDK's explicit TESTNET DST **before any network broadcast**.

A mainnet-domain signature, mismatched token symbol/supply/decimals, changed signer, malformed payload or wrong transfer function is rejected locally without a submit. No seed, private key or arbitrary RPC origin is requested or processed.

## What you can do on the public website

1. Open **/setup** on the actual published Symbiotic V3 website.
2. Install and unlock the official Amadeus extension (link available within the wallet panel). Manually choose **Testnet** within the extension if available. Do not import mainnet funds or share a recovery phrase with the site.
3. Connect and approve the public account request in the extension. The balance uses only the hard-pinned Amadeus public testnet RPC.
4. Fund that public testnet account using the official SDK's listed [testnet faucet](https://mcp.ama.one/testnet-faucet), if necessary.
5. Check that TESTBTC and TESTUSD still show **unregistered** in the native Coin registry. A symbol registered by another issuer must never be minted again.
6. Tick the explicit wallet-network and mint-consent confirmation. Choose **Approve & mint TESTBTC** or **Approve & mint TESTUSD**. The wallet asks for approval of a fixed, non-repeating Coin create-and-mint call: supply 1,000,000 units, 9 decimals, fixed supply, quote asset AMA. Reject if the wallet displays unexpected parameters.
7. Symbiotic locally verifies exact transaction content and the TESTNET cryptographic signature domain. **Only after that succeeds**, it submits packed bytes **once** to the pinned public testnet via `submitAndWait({ finalized:true })`.
8. The application independently checks the canonical native transaction, signer, method, successful receipt, finality, exact registered Coin supply, issuing wallet balance and rooted chain height. It displays a transaction hash only after those checks pass.

There is **no automatic retry after ambiguous RPC timeout**. Check the official [testnet explorer](https://testnet.explorer.ama.one), the global Coin registry and your public issuer balance before deciding whether a different transaction is safe.

## What is NOT completed

- Two independently witnessed wallet signing approvals for M3 have **not** been collected. A cryptographically checked M4 mint only proves **that particular wallet's** native testnet signature; it does NOT unlock LP actions or trading, nor close issue #3.
- Neither TESTBTC nor TESTUSD is claimed minted by a GitHub CI fixture. Actual issuance depends on a user-controlled wallet, sufficient test AMA, symbol availability and successful real finality.
- Two native RISC-V pool binaries remain intentionally non-initializable until a reviewed deployer public address is bound and real VM security is independently accepted.
- M6 deployment, M7 funded liquidity, M8 four real BUY+SELL swaps, M9 end-to-end terminal and M10/M11 operator and runtime acceptance remain blocked.
- The UI is on testnet only. Never treat a passing mock integration test as real funds, chain activity, token volume or verified acceptance.

## Source and reproducibility

- Native signature verifier: [lib/wallet/verify-testnet-signature.ts](../lib/wallet/verify-testnet-signature.ts).
- User-confirmed issuer flow: [lib/amadeus-token-issuance.ts](../lib/amadeus-token-issuance.ts).
- User activation: [app/setup/page.tsx](../app/setup/page.tsx).
- Exact experimental native assets: [lib/amadeus-tokens.ts](../lib/amadeus-tokens.ts).
- Tests: [tests/native-domain-signing.test.ts](../tests/native-domain-signing.test.ts) and [tests/native-testnet-onboarding.test.ts](../tests/native-testnet-onboarding.test.ts).

**The real next acceptance artifact is a finalized TESTBTC mint hash and a finalized TESTUSD mint hash**, independently confirmed with the public Coin registry and issuer balances. Neither transaction should be invented, submitted by a background worker, or signed without the wallet owner's explicit approval.
