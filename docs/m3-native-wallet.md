# M3 — Native Amadeus testnet wallets

Tracking issue: https://github.com/mushee-io/Symbiotic-V3/issues/3

## Security scope

- Official injected provider: window.amadeus, requiring isAmadeus and requestAccounts().
- Provider discovery is passive; requesting an account **only** happens when the person presses Connect.
- The extension handles approvals. Symbiotic does not request, store, sign with or transmit private keys, mnemonic phrases or encrypted vault files.
- Local Disconnect removes the displayed account and balance. The official provider does not document a revoke API; revoke dApp authorization in the extension.
- Subscribe to accountsChanged and disconnect and clean up listeners. A disconnected user is not silently reconnected.
- Missing extension, denied connection, invalid Base58 response, account switch and empty account arrays are handled without fake accounts.
- A native public key alone does not attest that the wallet is signing for testnet. The official bridge documentation does not currently expose getNetwork() or switchNetwork(). An optional network reporter, if present in a newer extension, must reply exactly testnet/amadeus-testnet to unblock the readiness check.
- Because provider network attestation is unavailable in the documented API, signing is **not executed** in M3. This prevents accidentally requesting mainnet-domain signatures. Even if an optional method reports testnet, swap and transaction actions stay disabled until later milestones.
- Never derive wallet network from the public testnet RPC's health status; the RPC and the signing extension can point at different networks.

## Verified, real AMA balances

The server endpoint GET /api/wallet/balance?address=<public-base58> uses only the pinned Amadeus testnet SDK:

1. Validate address as public Base58 (not a key).
2. Read native chain tip and rooted stats through the pinned testnet SDK.
3. Call sdk.wallet.getBalance(address, "AMA") through the same SDK.
4. Validate symbol AMA, finite non-negative flat and float, then show the SDK's reported floating balance without inventing a value or rounding to fake precision.
5. Return HTTP 503 with a null balance on invalid/unavailable RPC or malformed balance. No zero fallback.
6. Client discards stale balance requests on account change or disconnect; never submits transfer or trade transactions.

The initial market configuration contains only TESTBTC/AMA and TESTUSD/AMA. Token balances for those test assets cannot be verified until M4 actually mints tokens. Perpetuals, RWA and Notional remain Coming Soon.

## Automated acceptance

Run npm run typecheck, npm test, npm run build; GitHub Actions verifies these plus the live network RPC health smoke test separately.

Tests cover: missing provider, native provider discovery, two distinct **mock** accounts, user rejection, invalid address and account-change events, wallet-network mismatch/unverified handling, signer readiness gates, balance endpoint paths, zero AMA balance, invalid balances, RPC failure, invalid public address and no mainnet fallback.

**Mock tests are not live wallet witness evidence.** They cannot prove that two independent Amadeus extension installations or accounts approve connecting.

## Live two-wallet witness — REQUIRED before closing M3

On a publicly reachable Symbiotic V3 testnet build with the official Amadeus extension installed, collect the following evidence for Wallet A and Wallet B separately:

1. Connect manually and approve through the extension; record the public Base58 account, never secret data.
2. Verify the extension's selected network through an authoritative wallet-provided method, or record that signing network is **unverified**. An RPC health check cannot substitute.
3. Compare the AMA balance displayed in the UI against the pinned public testnet SDK / explorer response for the same address.
4. Change accounts and confirm old balances disappear. Disconnect locally and verify no remembered account is shown until manually reconnected.
5. Test rejected approval and locked-wallet responses.
6. Verify both accounts are different and retain independent signed-off test evidence, with redacted screenshots if needed.

If a version of the official extension has no verifiable network introspection, treat signing as blocked and mark this part **pending**. Do not close M3, claim testnet signing or invent two wallet witnesses.

## Official references

- https://docs.ama.one/wallet/creating-a-wallet/chrome-extension-wallet/10.-integration-guide
- https://github.com/amadeusprotocol/amadeus-wallet-extension-react-demo
- https://github.com/amadeusprotocol/amadeus-typescript-sdk
