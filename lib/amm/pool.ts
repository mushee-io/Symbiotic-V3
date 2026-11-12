/**
 * M5 simulation-only immutable pool state transitions.
 * These are native-RISC-V design tests, NOT ledger state or live trading.
 * The actual Amadeus contract must separately implement and validate the
 * same transitions, attachments, per-caller LP storage and Coin transfers.
 */
import { isAmaAddress } from "../amadeus-wallet";
import { TEST_ASSETS } from "../markets";
import {
  AmmMathError, MAX_RESERVE, MIN_LOCKED_LP, asAtomic, checkedAdd, checkedMul,
  initialLiquidity, addLiquidity, quoteExactIn, removeLiquidity,
} from "./math";

export type Base = typeof TEST_ASSETS[number];
export type PairId = "TESTBTC/AMA" | "TESTUSD/AMA";
export type SwapSide = "BASE_TO_AMA" | "AMA_TO_BASE";

export type PoolState = Readonly<{
  pair: PairId;
  base: Base;
  quote: "AMA";
  reserveBase: bigint;
  reserveAma: bigint;
  totalLp: bigint; // Includes irrecoverably locked MIN_LOCKED_LP shares.
  lpBalances: Readonly<Record<string, bigint>>;
  admin: string;
  paused: boolean;
}>;

export function requirePair(base: string): Base {
  if (!TEST_ASSETS.some((asset) => asset === base)) throw new AmmMathError("unsupported_market");
  return base as Base;
}
function requireAccount(account: string): string {
  if (!isAmaAddress(account)) throw new AmmMathError("invalid_caller");
  return account;
}
export function validatePool(pool: PoolState): void {
  const base = requirePair(pool.base);
  if (pool.pair !== base + "/AMA" || pool.quote !== "AMA") throw new AmmMathError("wrong_quote");
  requireAccount(pool.admin);
  asAtomic(pool.reserveBase, "reserve_base");
  asAtomic(pool.reserveAma, "reserve_ama");
  asAtomic(pool.totalLp, "total_lp");
  if (pool.totalLp < MIN_LOCKED_LP) throw new AmmMathError("invalid_lp_supply");
  if (!pool.reserveBase || !pool.reserveAma) throw new AmmMathError("zero_liquidity");
  let sum = MIN_LOCKED_LP;
  for (const [account, amount] of Object.entries(pool.lpBalances)) {
    requireAccount(account);
    asAtomic(amount, "owner_shares");
    sum = checkedAdd(sum, amount, MAX_RESERVE);
  }
  if (sum !== pool.totalLp) throw new AmmMathError("lp_supply_mismatch");
  checkedMul(pool.reserveBase, pool.reserveAma);
}

export function initializePool(
  baseValue: string, adminAccount: string, baseAmount: bigint, amaAmount: bigint,
): PoolState {
  const base = requirePair(baseValue);
  const admin = requireAccount(adminAccount);
  const initial = initialLiquidity(baseAmount, amaAmount);
  const state: PoolState = {
    base, pair: (base + "/AMA") as PairId, quote: "AMA",
    reserveBase: initial.usedBase, reserveAma: initial.usedAma,
    totalLp: initial.mintedLp + initial.lockedLp,
    lpBalances: { [admin]: initial.mintedLp }, admin, paused: false,
  };
  validatePool(state);
  return state;
}

export function setPaused(pool: PoolState, actor: string, paused: boolean): PoolState {
  validatePool(pool);
  if (requireAccount(actor) !== pool.admin) throw new AmmMathError("admin_only");
  return { ...pool, paused };
}

export function depositLp(
  pool: PoolState, actor: string,
  desiredBase: bigint, desiredAma: bigint, minimumLp: bigint,
): { pool: PoolState; usedBase: bigint; usedAma: bigint; mintedLp: bigint } {
  validatePool(pool);
  const caller = requireAccount(actor);
  if (pool.paused) throw new AmmMathError("paused");
  const q = addLiquidity(pool.reserveBase, pool.reserveAma, pool.totalLp,
    desiredBase, desiredAma, minimumLp);
  const next: PoolState = {
    ...pool,
    reserveBase: checkedAdd(pool.reserveBase, q.usedBase, MAX_RESERVE),
    reserveAma: checkedAdd(pool.reserveAma, q.usedAma, MAX_RESERVE),
    totalLp: checkedAdd(pool.totalLp, q.mintedLp, MAX_RESERVE),
    lpBalances: {
      ...pool.lpBalances,
      [caller]: checkedAdd(pool.lpBalances[caller] ?? 0n, q.mintedLp, MAX_RESERVE),
    },
  };
  validatePool(next);
  return { pool: next, usedBase: q.usedBase, usedAma: q.usedAma, mintedLp: q.mintedLp };
}

export function withdrawLp(
  pool: PoolState, actor: string, shares: bigint,
  minimumBaseOut: bigint, minimumAmaOut: bigint,
): { pool: PoolState; baseOut: bigint; amaOut: bigint } {
  validatePool(pool);
  const caller = requireAccount(actor);
  asAtomic(shares, "shares");
  if (!shares || (pool.lpBalances[caller] ?? 0n) < shares)
    throw new AmmMathError("lp_not_owned");
  // LP holders may withdraw when paused (emergency exit), never below locked shares.
  const q = removeLiquidity(pool.reserveBase, pool.reserveAma, pool.totalLp,
    shares, minimumBaseOut, minimumAmaOut);
  const next: PoolState = {
    ...pool,
    reserveBase: pool.reserveBase - q.baseOut,
    reserveAma: pool.reserveAma - q.amaOut,
    totalLp: q.remainingLp,
    lpBalances: {
      ...pool.lpBalances, [caller]: (pool.lpBalances[caller] ?? 0n) - shares,
    },
  };
  validatePool(next);
  return { pool: next, baseOut: q.baseOut, amaOut: q.amaOut };
}

export function swapExactIn(
  pool: PoolState, side: SwapSide, actor: string,
  amountIn: bigint, minOut: bigint,
): { pool: PoolState; amountOut: bigint; feeBps: bigint } {
  validatePool(pool);
  requireAccount(actor);
  if (pool.paused) throw new AmmMathError("paused");
  if (side !== "BASE_TO_AMA" && side !== "AMA_TO_BASE")
    throw new AmmMathError("invalid_direction");
  const baseToAma = side === "BASE_TO_AMA";
  const q = quoteExactIn(
    baseToAma ? pool.reserveBase : pool.reserveAma,
    baseToAma ? pool.reserveAma : pool.reserveBase,
    amountIn, minOut,
  );
  const next: PoolState = {
    ...pool,
    reserveBase: baseToAma ? q.newReserveIn : q.newReserveOut,
    reserveAma: baseToAma ? q.newReserveOut : q.newReserveIn,
  };
  validatePool(next);
  if (checkedMul(next.reserveBase, next.reserveAma) <
      checkedMul(pool.reserveBase, pool.reserveAma)) {
    throw new AmmMathError("invariant_decreased");
  }
  return { pool: next, amountOut: q.amountOut, feeBps: q.feeBps };
}
