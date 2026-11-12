import { addLiquidity, removeLiquidity, asAtomic, AmmMathError, MAX_RESERVE } from "../amm/math";
import { require48ByteAddress, LiquidityUnavailableError } from "./deployments";
import type { PoolSnapshot } from "./read";

/** Native Coin attachment, never an ERC-20 approval/allowance. */
export type NativeCoinAttachment = Readonly<{ symbol: "AMA" | "TESTBTC" | "TESTUSD"; amount: string }>;
export type LiquidityIntent = Readonly<{
  contract: string;
  method: "add_liquidity" | "remove_liquidity";
  args: readonly string[];
  attachments: readonly NativeCoinAttachment[];
  pair: "TESTBTC/AMA" | "TESTUSD/AMA";
  signer: string;
  expected: Readonly<{ base: string; ama: string; lp: string }>;
  walletApprovalRequired: true;
  broadcastEnabled: false;
}>;

export function positiveAtomic(value: unknown, name: string): bigint {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) {
    throw new LiquidityUnavailableError("invalid_" + name);
  }
  const result = BigInt(value);
  try { asAtomic(result, name, MAX_RESERVE); }
  catch { throw new LiquidityUnavailableError("invalid_" + name); }
  return result;
}

export function validateLiquiditySnapshot(state: PoolSnapshot, signer: string) {
  require48ByteAddress(signer);
  if (state.reconciled !== true || state.owner !== signer || state.ownerLp === null ||
      state.custodyBase !== state.reserveBase || state.custodyAma !== state.reserveAma ||
      (state.pair !== "TESTBTC/AMA" && state.pair !== "TESTUSD/AMA") ||
      state.pair !== state.symbol + "/AMA") {
    throw new LiquidityUnavailableError("snapshot_not_authenticated");
  }
  return state;
}

export function deadlineAt(height: number, deadline: number): string {
  if (!Number.isSafeInteger(height) || height < 0 ||
      !Number.isSafeInteger(deadline) || deadline <= height ||
      deadline > height + 20) {
    throw new LiquidityUnavailableError("invalid_native_height_deadline");
  }
  return String(deadline);
}

/**
 * Creates a display-only immutable intent for the future wallet adapter.
 * The documented Amadeus extension's signTransaction has no attachment
 * parameter. Never call it for liquidity: that would sign a zero-deposit tx.
 */
export function buildAddLiquidityIntent(
  state: PoolSnapshot, signer: string,
  desiredBase: string, desiredAma: string, minimumLp: string,
  chainHeight: number, expiresHeight: number,
): LiquidityIntent {
  validateLiquiditySnapshot(state, signer);
  if (state.paused) throw new LiquidityUnavailableError("pool_paused");
  const base = positiveAtomic(desiredBase, "desired_base");
  const ama = positiveAtomic(desiredAma, "desired_ama");
  const min = positiveAtomic(minimumLp, "minimum_lp");
  const deadline = deadlineAt(chainHeight, expiresHeight);
  let q: ReturnType<typeof addLiquidity>;
  try {
    q = addLiquidity(BigInt(state.reserveBase), BigInt(state.reserveAma),
      BigInt(state.totalLp), base, ama, min);
  } catch (error) {
    if (error instanceof AmmMathError) throw new LiquidityUnavailableError(error.code);
    throw error;
  }
  // The full amounts are attached; the actual M6 contract refunds unused
  // deposits via native Coin.transfer. Never send only "used" amounts.
  return {
    contract: state.address, method: "add_liquidity",
    args: [String(min), deadline],
    attachments: [{ symbol: state.symbol, amount: String(base) }, { symbol: "AMA", amount: String(ama) }],
    pair: state.pair, signer,
    expected: { base: String(q.usedBase), ama: String(q.usedAma), lp: String(q.mintedLp) },
    walletApprovalRequired: true, broadcastEnabled: false,
  };
}

export function buildRemoveLiquidityIntent(
  state: PoolSnapshot, signer: string,
  shares: string, minimumBase: string, minimumAma: string,
  chainHeight: number, expiresHeight: number,
): LiquidityIntent {
  validateLiquiditySnapshot(state, signer);
  const burn = positiveAtomic(shares, "lp_shares");
  const minB = positiveAtomic(minimumBase, "minimum_base");
  const minA = positiveAtomic(minimumAma, "minimum_ama");
  const deadline = deadlineAt(chainHeight, expiresHeight);
  if (burn > BigInt(state.ownerLp!)) throw new LiquidityUnavailableError("lp_not_owned");
  let q: ReturnType<typeof removeLiquidity>;
  try {
    q = removeLiquidity(BigInt(state.reserveBase), BigInt(state.reserveAma),
      BigInt(state.totalLp), burn, minB, minA);
  } catch (error) {
    if (error instanceof AmmMathError) throw new LiquidityUnavailableError(error.code);
    throw error;
  }
  return {
    contract: state.address, method: "remove_liquidity",
    args: [String(burn), String(minB), String(minA), deadline],
    attachments: [], pair: state.pair, signer,
    expected: { base: String(q.baseOut), ama: String(q.amaOut), lp: String(burn) },
    walletApprovalRequired: true, broadcastEnabled: false,
  };
}

/** The available official extension cannot safely sign native attachments. */
export function requireDocumentedLiquiditySigningCapability(provider: unknown): never {
  void provider;
  throw new LiquidityUnavailableError("wallet_attachment_signing_not_verified");
}
