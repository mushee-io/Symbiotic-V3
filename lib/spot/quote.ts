import { AmmMathError, AMM_FEE_BPS, BPS_DENOMINATOR, quoteExactIn } from "../amm/math";
import { LiquidityUnavailableError } from "../liquidity/deployments";
import { positiveAtomic } from "../liquidity/intent";
import type { PoolSnapshot } from "../liquidity/read";

export type SpotSide = "BUY" | "SELL";
export type SpotPair = "TESTBTC/AMA" | "TESTUSD/AMA";

/** Native M6 spot guest is immutable and only permits these two AMA quotes. */
export function requireSpotSide(value: unknown): SpotSide {
  if (value !== "BUY" && value !== "SELL") throw new LiquidityUnavailableError("unsupported_side");
  return value;
}
export function validateSlippageBps(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) ||
      value < 1 || value > 500) throw new LiquidityUnavailableError("invalid_slippage_bps");
  return value;
}

export function assertVerifiedSpotPool(state: PoolSnapshot): PoolSnapshot {
  if (state.reconciled !== true || !["TESTBTC", "TESTUSD"].includes(state.symbol) ||
      state.pair !== state.symbol + "/AMA" ||
      state.custodyBase !== state.reserveBase ||
      state.custodyAma !== state.reserveAma ||
      state.paused !== false) {
    throw new LiquidityUnavailableError("spot_pool_not_reconciled");
  }
  const reserveBase = positiveAtomic(state.reserveBase, "reserve_base");
  const reserveAma = positiveAtomic(state.reserveAma, "reserve_ama");
  if (!reserveBase || !reserveAma || BigInt(state.totalLp) < 1000n) {
    throw new LiquidityUnavailableError("spot_pool_empty");
  }
  return state;
}

export type NativeSpotQuote = Readonly<{
  pair: SpotPair;
  side: SpotSide;
  inputSymbol: "AMA" | "TESTBTC" | "TESTUSD";
  outputSymbol: "AMA" | "TESTBTC" | "TESTUSD";
  amountIn: string; expectedOut: string; minimumOut: string;
  feeBps: 30;
  slippageBps: number;
  /** Relative shortfall vs pre-swap reserve ratio; includes fee and price impact. */
  effectivePriceImpactBps: string;
  reserveBase: string; reserveAma: string;
  reserveInAfter: string; reserveOutAfter: string;
  invariantBefore: string; invariantAfter: string;
  poolAddress: string;
}>;

/**
 * Quote is valid only when caller supplies an actual independently reconciled
 * testnet pool snapshot, never mock market prices. All arithmetic is BigInt.
 */
export function quoteNativeSpot(
  state: PoolSnapshot, rawSide: unknown, rawAmount: unknown, rawSlippageBps: unknown,
): NativeSpotQuote {
  assertVerifiedSpotPool(state);
  const side = requireSpotSide(rawSide);
  const amount = positiveAtomic(rawAmount, "swap_input");
  const slippageBps = validateSlippageBps(rawSlippageBps);
  const reserveIn = BigInt(side === "BUY" ? state.reserveAma : state.reserveBase);
  const reserveOut = BigInt(side === "BUY" ? state.reserveBase : state.reserveAma);
  let q: ReturnType<typeof quoteExactIn>;
  try {
    q = quoteExactIn(reserveIn, reserveOut, amount, 1n);
  } catch (error) {
    if (error instanceof AmmMathError) throw new LiquidityUnavailableError(error.code);
    throw error;
  }
  const minOut = q.amountOut * (BPS_DENOMINATOR - BigInt(slippageBps)) / BPS_DENOMINATOR;
  if (minOut === 0n || minOut > q.amountOut) {
    throw new LiquidityUnavailableError("slippage_rounding_to_zero");
  }
  const pretradeNoFeeOut = amount * reserveOut / reserveIn;
  if (!pretradeNoFeeOut || pretradeNoFeeOut < q.amountOut) {
    throw new LiquidityUnavailableError("invalid_reference_reserve_ratio");
  }
  const impactBps = (pretradeNoFeeOut - q.amountOut) * BPS_DENOMINATOR / pretradeNoFeeOut;
  return {
    pair: state.pair, side,
    inputSymbol: side === "BUY" ? "AMA" : state.symbol,
    outputSymbol: side === "BUY" ? state.symbol : "AMA",
    amountIn: String(amount), expectedOut: String(q.amountOut), minimumOut: String(minOut),
    feeBps: Number(AMM_FEE_BPS) as 30,
    slippageBps, effectivePriceImpactBps: String(impactBps),
    reserveBase: state.reserveBase, reserveAma: state.reserveAma,
    reserveInAfter: String(q.newReserveIn), reserveOutAfter: String(q.newReserveOut),
    invariantBefore: String(q.invariantBefore), invariantAfter: String(q.invariantAfter),
    poolAddress: state.address,
  };
}
