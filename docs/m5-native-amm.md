# M5 — Native Amadeus spot AMM architecture

Tracking: https://github.com/mushee-io/Symbiotic-V3/issues/5

## Scope and deployment status

M5 implements deterministic, off-chain reference AMM math and a portable no_std Rust math library. It is not a live deployed AMM. No pools, reserves, swaps or volume have been created on-chain, and the swap UI remains disabled. The native guest dispatch, state custody, final deployable ELF and two testnet contracts belong to M6.

The Amadeus native contract runtime is RISC-V (RV64IM + Zba/Zbb) ELF, not Solidity, EVM or WASM. Official sources:
- https://github.com/amadeusprotocol/node/blob/main/contract_samples/riscv/README.md
- https://github.com/amadeusprotocol/node/blob/main/contract_samples/riscv/examples/deposit.rs
- https://github.com/amadeusprotocol/node/blob/main/contract_samples/riscv/src/lib.rs

## Strict AMA pairs

Only TESTBTC/AMA and TESTUSD/AMA are allowed. AMA is always the quote asset. The pool instances will have immutable base symbol, AMA quote, admin, reserves, LP ledger and pause flag. LP shares are internal accounting only, not transferable Coin tokens.

## Precision and limits

- All amounts are 9-decimal atomic native Coin units; no floating-point calculations.
- Fee: 30 basis points, denominator 10,000; charged implicitly and retained in the pool.
- Each reserve is capped at 10^16 atomic units. Every intermediate add/multiply is bounded to signed i128 maximum (2^127-1).
- Permanent initial liquidity lock: 1,000 LP shares. Admin may pause swaps and new deposits but not LP exits.
- No external reference oracle or synthetic order history.

## Math and exact rounding

Given reserves X and Y and a signed input D:

net = D * (10000 - 30)
out = floor(net * Y / (10000 * X + net))
Xnew = X + D
Ynew = Y - out

Inputs and reserves must be strictly positive. Refuse if output is zero, is >= Y, or is less than the strictly positive caller minOut. Check that Xnew*Ynew >= X*Y; all arithmetic uses checked integer operations. No protocol fee extraction, and integer rounding benefits the vault, not the swapper.

First LP provider: minted = floor(sqrt(baseDeposit*amaDeposit)) - 1000, with 1000 permanently locked. Reject root <= 1000.
Further LP: minted = min(floor(desiredBase*LPtotal/reserveBase),floor(desiredAma*LPtotal/reserveAma)); accepted deposits are ceil(minted*reserve/LPtotal) on each side, never above desired amounts. Unused inputs must be refunded by the future native guest. Require minted >= minLP > 0.
Withdrawal: baseOut=floor(shares*reserveBase/LPtotal); amaOut=floor(shares*reserveAma/LPtotal). Caller must own shares and require both outputs >= strictly positive signed minimums. Burn only caller-owned shares; permanent initial LP lock cannot be burned. Ledger invariant: total LP == 1000 locked + sum(all holder shares).
Only swap transitions require nondecreasing k. Liquidity changes need correct share/reserve accounting, not fixed k.

## M6 native contract ABI design (NOT YET DEPLOYED)

Native Amadeus contracts run no_std/no_main guest dispatch and use amadeus_contract c::function, c::arg, c::attachments, c::account_caller, c::kv_get/kv_put, c::call and c::abort/ret from the official RISC-V sample host.

- init(base, admin) — accept exactly two positive attached native Coins (base and AMA), set immutable base/quote/admin, create reserves and initial LP with permanent 1,000-share lock
- add_liquidity(minLp, deadline) — caller attaches base and AMA, require non-expired chain height, credit accepted proportions, return unused attached amounts via native Coin.transfer, mint internal LP ledger to native account_caller
- remove_liquidity(shares, minBaseOut, minAmaOut, deadline) — caller-only LP burn; update reserves before Coin.transfer; exit permitted during emergency pause
- swap_exact_in(minOut, deadline) — exactly one attached native Coin (base or AMA); verify direction, height/expiry, fee and minOut, update reserves and Coin.transfer other asset to caller
- pause / unpause — immutable admin only, fail closed to unprivileged callers
- get_reserves / get_lp — view current native storage only; never imply active trade until deployment and receipts

The real guest MUST authenticate using chain-provided 48-byte account caller, not a browser-supplied string, and persist a scoped internal LP ledger. Prevent reentrancy with a contract-scoped guard around nested Coin calls, verify chain atomic rollback and storage-account reconciliation on native testnet, reject unexpected attachments or symbols, and never credit external direct donations as LP. Protect all deadlines by native chain entry height/slot, not browser clock. Check runtime gas and signed i128 arithmetic with the compiled RV64 binary. Deploy one immutable instance per approved pair only.

## Tests and acceptance

- TypeScript math and simulation: deterministic quotes, both directions, LP addition/removal/rounding, locked shares, max reserves, overflow, zero liquidity, dust, slippage, incorrect pair, unauthorized LP removal, emergency pause and 1,200 seeded property cases.
- Rust no_std math: independent constant-product quote and LP arithmetic with host cargo tests. This portable library is a reference and does not contain guest storage/asset calls.
- Commands: npm run typecheck; npm test; npm run build; cargo test --manifest-path contracts/amadeus-riscv/math/Cargo.toml --offline.

M5 may close once these deterministic math and RISC-V design gates pass with review and green CI. This does NOT imply wallet, mint, contract deployment or swaps passed acceptance. M3 remains open until two independently witnessed real wallets and signing-network proof. M4 remains open until two finalized native token issuance receipts. M6, M7 and M8 must verify contract deployments, actual reserves and real signed swaps before enabling trading.
