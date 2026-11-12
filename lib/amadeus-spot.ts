/**
 * V1 constant-product pricing for a future AMADEUS TESTNET spot AMM.
 * Pure deterministic math only; NOT an on-chain pool or trade executor.
 * All amounts are integer atomic units. Never convert to floating point
 * during swap calculation. Actual contract must enforce these same bounds.
 */
export type SpotSide = "BUY" | "SELL";
export type SpotPoolReserves = {
  baseAtomic: bigint;
  amaAtomic: bigint;
};

export function quoteSpotExactIn(
  pool: SpotPoolReserves,
  side: SpotSide,
  amountInAtomic: bigint,
  feeBps = 30,
): { amountOutAtomic: bigint; feeInputAtomic: bigint; minReserveOutAtomic: bigint } {
  if (pool.baseAtomic <= 0n || pool.amaAtomic <= 0n) {
    throw new Error("Pool must have verified positive reserves");
  }
  if (amountInAtomic <= 0n) throw new Error("Input must be positive");
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps >= 10000) {
    throw new Error("Invalid fee basis points");
  }
  const reserveIn = side === "BUY" ? pool.amaAtomic : pool.baseAtomic;
  const reserveOut = side === "BUY" ? pool.baseAtomic : pool.amaAtomic;
  const adjustedIn = amountInAtomic * BigInt(10000 - feeBps) / 10000n;
  if (adjustedIn <= 0n) throw new Error("Input is too small after fees");
  const out = reserveOut * adjustedIn / (reserveIn + adjustedIn);
  if (out <= 0n || out >= reserveOut) throw new Error("Insufficient output or pool liquidity");
  return {
    amountOutAtomic: out,
    feeInputAtomic: amountInAtomic - adjustedIn,
    minReserveOutAtomic: reserveOut - out,
  };
}

export function minOutputAfterSlippage(amountOutAtomic: bigint, slippageBps: number): bigint {
  if (amountOutAtomic <= 0n) throw new Error("Invalid output");
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 1000) {
    throw new Error("Slippage must be between 0 and 1000 bps");
  }
  return amountOutAtomic * BigInt(10000 - slippageBps) / 10000n;
}
