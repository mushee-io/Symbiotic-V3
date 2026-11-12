/**
 * M5 deterministic reference arithmetic for the Amadeus native RISC-V AMM.
 * This module is OFF-CHAIN, never a deployed contract, a market data feed,
 * or permission to execute a swap. All quantities are atomic integer units.
 */
export const AMM_FEE_BPS = 30n; // 0.30%; fee remains inside pool reserves
export const BPS_DENOMINATOR = 10_000n;
export const MIN_LOCKED_LP = 1_000n;
export const MAX_RESERVE = 10n ** 16n; // conservative RISC-V i128 arithmetic bound
export const MAX_I128 = (1n << 127n) - 1n;

export class AmmMathError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "AmmMathError";
  }
}

export function asAtomic(value: bigint, label: string, max = MAX_RESERVE): bigint {
  if (typeof value !== "bigint" || value < 0n || value > max)
    throw new AmmMathError("invalid_" + label);
  return value;
}
export function checkedAdd(a: bigint, b: bigint, max = MAX_I128): bigint {
  const sum = a + b;
  if (sum < 0n || sum > max) throw new AmmMathError("overflow");
  return sum;
}
export function checkedMul(a: bigint, b: bigint): bigint {
  const product = a * b;
  if (a < 0n || b < 0n || product > MAX_I128) throw new AmmMathError("overflow");
  return product;
}
export function ceilDiv(a: bigint, b: bigint): bigint {
  if (a < 0n || b <= 0n) throw new AmmMathError("invalid_division");
  return a / b + (a % b === 0n ? 0n : 1n);
}
/** Exact integer sqrt, rounded down, and never floating point. */
export function sqrtFloor(value: bigint): bigint {
  if (value < 0n || value > MAX_I128) throw new AmmMathError("invalid_radicand");
  if (value < 2n) return value;
  let x = value;
  let y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + value / x) / 2n; }
  return x;
}

export type SwapQuote = {
  amountIn: bigint; amountOut: bigint; feeBps: bigint;
  newReserveIn: bigint; newReserveOut: bigint;
  invariantBefore: bigint; invariantAfter: bigint;
};
export function quoteExactIn(
  reserveIn: bigint, reserveOut: bigint, amountIn: bigint, minOut: bigint,
): SwapQuote {
  asAtomic(reserveIn, "reserve_in");
  asAtomic(reserveOut, "reserve_out");
  asAtomic(amountIn, "amount_in");
  asAtomic(minOut, "minimum_output");
  if (!reserveIn || !reserveOut) throw new AmmMathError("zero_liquidity");
  if (!amountIn) throw new AmmMathError("zero_input");
  if (!minOut) throw new AmmMathError("minimum_output_required");
  const newReserveIn = checkedAdd(reserveIn, amountIn, MAX_RESERVE);
  const feeAdjustedIn = checkedMul(amountIn, BPS_DENOMINATOR - AMM_FEE_BPS);
  const numerator = checkedMul(feeAdjustedIn, reserveOut);
  const denominator = checkedAdd(checkedMul(reserveIn, BPS_DENOMINATOR), feeAdjustedIn);
  const amountOut = numerator / denominator; // round DOWN to protect vault
  if (amountOut === 0n || amountOut >= reserveOut) throw new AmmMathError("dust_or_empty_pool");
  if (amountOut < minOut) throw new AmmMathError("slippage_exceeded");
  const newReserveOut = reserveOut - amountOut;
  const invariantBefore = checkedMul(reserveIn, reserveOut);
  const invariantAfter = checkedMul(newReserveIn, newReserveOut);
  if (invariantAfter < invariantBefore) throw new AmmMathError("invariant_decreased");
  return {
    amountIn, amountOut, feeBps: AMM_FEE_BPS,
    newReserveIn, newReserveOut, invariantBefore, invariantAfter,
  };
}

export type LiquidityQuote = {
  usedBase: bigint; usedAma: bigint;
  mintedLp: bigint; lockedLp: bigint;
};
export function initialLiquidity(base: bigint, ama: bigint): LiquidityQuote {
  asAtomic(base, "base");
  asAtomic(ama, "ama");
  if (!base || !ama) throw new AmmMathError("zero_liquidity");
  const root = sqrtFloor(checkedMul(base, ama));
  if (root <= MIN_LOCKED_LP) throw new AmmMathError("initial_liquidity_too_small");
  return { usedBase: base, usedAma: ama, mintedLp: root - MIN_LOCKED_LP, lockedLp: MIN_LOCKED_LP };
}
export function addLiquidity(
  reserveBase: bigint, reserveAma: bigint, totalLp: bigint,
  desiredBase: bigint, desiredAma: bigint,
  minimumLp: bigint,
): LiquidityQuote {
  [reserveBase, reserveAma, totalLp, desiredBase, desiredAma].forEach((value) => asAtomic(value, "liquidity"));
  asAtomic(minimumLp, "minimum_lp");
  if (!reserveBase || !reserveAma || !totalLp) throw new AmmMathError("zero_liquidity");
  if (!desiredBase || !desiredAma) throw new AmmMathError("zero_input");
  if (!minimumLp) throw new AmmMathError("minimum_lp_required");
  const sharesFromBase = checkedMul(desiredBase, totalLp) / reserveBase;
  const sharesFromAma = checkedMul(desiredAma, totalLp) / reserveAma;
  const mintedLp = sharesFromBase < sharesFromAma ? sharesFromBase : sharesFromAma;
  if (!mintedLp) throw new AmmMathError("lp_dust");
  if (mintedLp < minimumLp) throw new AmmMathError("slippage_exceeded");
  const usedBase = ceilDiv(checkedMul(mintedLp, reserveBase), totalLp);
  const usedAma = ceilDiv(checkedMul(mintedLp, reserveAma), totalLp);
  if (!usedBase || !usedAma || usedBase > desiredBase || usedAma > desiredAma)
    throw new AmmMathError("invalid_lp_deposit");
  checkedAdd(reserveBase, usedBase, MAX_RESERVE);
  checkedAdd(reserveAma, usedAma, MAX_RESERVE);
  checkedAdd(totalLp, mintedLp, MAX_RESERVE);
  return { usedBase, usedAma, mintedLp, lockedLp: 0n };
}
export function removeLiquidity(
  reserveBase: bigint, reserveAma: bigint, totalLp: bigint,
  shares: bigint, minimumBaseOut: bigint, minimumAmaOut: bigint,
): { baseOut: bigint; amaOut: bigint; remainingLp: bigint } {
  [reserveBase, reserveAma, totalLp, shares].forEach((value) => asAtomic(value, "liquidity"));
  asAtomic(minimumBaseOut, "minimum_base");
  asAtomic(minimumAmaOut, "minimum_ama");
  if (!reserveBase || !reserveAma || !totalLp || shares <= 0n) throw new AmmMathError("zero_liquidity");
  if (shares > totalLp - MIN_LOCKED_LP) throw new AmmMathError("locked_liquidity");
  if (!minimumBaseOut || !minimumAmaOut) throw new AmmMathError("minimum_output_required");
  const baseOut = checkedMul(shares, reserveBase) / totalLp;
  const amaOut = checkedMul(shares, reserveAma) / totalLp;
  if (!baseOut || !amaOut) throw new AmmMathError("lp_dust");
  if (baseOut < minimumBaseOut || amaOut < minimumAmaOut)
    throw new AmmMathError("slippage_exceeded");
  return { baseOut, amaOut, remainingLp: totalLp - shares };
}
