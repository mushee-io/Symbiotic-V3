# Market-maker release gate — Amadeus testnet

This change prepares **reproducible, public-address-bound pool binaries**. It does not deploy contracts, mint tokens, fund pools, execute swaps, or authorize an automated market maker.

## Pool release build

The checked-in default build has a zero-valued initializer key. It **cannot be initialized by anyone** and is intended for untrusted CI and analysis.

For a reviewed **testnet-only** release, use the official public wallet address as `AMA_POOL_INITIALIZER`. It is a public identifier, never a seed or private key. Cargo's `build.rs` validates canonical base58, exact 48 decoded bytes, and a nonzero account before generating a compile-time constant. A wrong account or malformed input fails the build. Both pool ELF binaries must be rebuilt with that variable set. The same bound public account must approve each pool's actual native initialization transaction.

```bash
export AMA_POOL_INITIALIZER='PUBLIC_AMA_TESTNET_WALLET_ADDRESS'
bash contracts/amadeus-riscv/pools/build.sh
```

Do not publish a release with a guessed wallet, copy an unbound CI artifact as if deployable, or claim two deploy receipts on the basis of ELF hashes. The deployment owner's proof and independently checked on-chain receipts must be recorded before adding certified pool addresses to `lib/liquidity/deployments.ts`.

## Execution safety

- Allowed markets: TESTBTC/AMA and TESTUSD/AMA only.
- AMA is the only quote asset.
- TESTBTC and TESTUSD require separate, finalized native Coin mint transactions with public issuer and supply evidence.
- Native attached-Coin wallet signing is not yet verified. Do not synthesize attachments, collect a signing key, or bypass consent.
- Pool initialization needs correct native attachments, finalized receipts, native VM runtime rollback/transfer tests, custody reconciliation, and an authenticated admin.
- Before activating automated market making, require independent reference pricing, independently reconciled daily PnL, authenticated operator controls, an actual server-side kill switch, and witnessed bidirectional swaps on both pairs.
- Until then the agent remains a read-only HOLD/STOP service; public dashboard toggles do not control a real trading worker.

## Verification

The CI `amadeus-only` job compiles and runs unit tests for the build-time initializer parser. The existing `riscv-elf` job still produces inert artifacts unless an explicitly reviewed release injects the public initializer. Inspect job outcomes and reproducible ELF SHA-256 digests; a green check is not testnet deployment proof.

User-provided funding wallet can be used as the reviewed public initializer once its ownership and network are independently witnessed in the wallet. It must not be automatically assumed to be a deployment signer.
