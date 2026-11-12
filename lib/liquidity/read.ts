import type { AmadeusSDK } from "@amadeus-protocol/sdk";
import { fromBase58 } from "@amadeus-protocol/sdk";
import {
  require48ByteAddress, validatePoolCertificate,
  LiquidityUnavailableError, type PoolCertificate,
} from "./deployments";

const atomic = (text: unknown, tag: string): bigint => {
  if (typeof text !== "string" || !/^(0|[1-9][0-9]*)$/.test(text)) {
    throw new LiquidityUnavailableError("invalid_" + tag);
  }
  const value = BigInt(text);
  if (value < 0n || value > 10n ** 16n) {
    throw new LiquidityUnavailableError("invalid_" + tag);
  }
  return value;
};

export type PoolSnapshot = Readonly<{
  symbol: "TESTBTC" | "TESTUSD";
  pair: "TESTBTC/AMA" | "TESTUSD/AMA";
  address: string;
  reserveBase: string;
  reserveAma: string;
  totalLp: string;
  paused: boolean;
  custodyBase: string;
  custodyAma: string;
  owner: string | null;
  ownerLp: string | null;
  reconciled: true;
}>;

export function parseNativeReserves(result: unknown) {
  if (typeof result !== "string") throw new LiquidityUnavailableError("invalid_native_reserves");
  const parts = result.split("|");
  if (parts.length !== 4 || !["0", "1"].includes(parts[3])) {
    throw new LiquidityUnavailableError("invalid_native_reserves");
  }
  const reserveBase = atomic(parts[0], "base_reserve");
  const reserveAma = atomic(parts[1], "ama_reserve");
  const totalLp = atomic(parts[2], "lp_total");
  if (reserveBase === 0n || reserveAma === 0n || totalLp < 1000n) {
    throw new LiquidityUnavailableError("empty_or_uninitialized_pool");
  }
  return { reserveBase, reserveAma, totalLp, paused: parts[3] === "1" };
}

/** SDK returns JS numbers for Coin.flat; reject unsafe integers, never round. */
export function parseActualCoinBalance(value: unknown, symbol: string): bigint {
  if (!value || typeof value !== "object") {
    throw new LiquidityUnavailableError("invalid_custody_balance");
  }
  const outer = value as Record<string, unknown>;
  const b = outer.balance;
  if (!b || typeof b !== "object") {
    throw new LiquidityUnavailableError("invalid_custody_balance");
  }
  const balance = b as Record<string, unknown>;
  if (balance.symbol !== symbol || typeof balance.flat !== "number" ||
      !Number.isSafeInteger(balance.flat) || balance.flat < 0) {
    throw new LiquidityUnavailableError("unsafe_custody_precision");
  }
  return BigInt(balance.flat);
}

type Reader = Pick<AmadeusSDK, "contract" | "wallet">;
const view = async (sdk: Reader, contract: string, fn: string, caller?: string) => {
  const result = await sdk.contract.view({
    contract, function: fn, args: [],
    ...(caller ? { pk: fromBase58(require48ByteAddress(caller)) } : {}),
  });
  if (result.success !== true || typeof result.result !== "string") {
    throw new LiquidityUnavailableError("native_view_rejected");
  }
  return result.result;
};

/**
 * All sources are ACTUAL pinned-testnet contract views & Coin holdings.
 * Double read of reserves prevents mixing a snapshot across two ledger tips.
 * Mismatch or a token amount outside safe JS integer range fails closed.
 */
export async function reconcileNativePool(
  sdk: Reader, candidate: PoolCertificate, owner?: string,
): Promise<PoolSnapshot> {
  const pool = validatePoolCertificate(candidate, candidate.symbol);
  if (owner) require48ByteAddress(owner);
  const base = await view(sdk, pool.address, "get_base");
  if (base !== pool.symbol) throw new LiquidityUnavailableError("wrong_onchain_pool_base");
  const before = await view(sdk, pool.address, "get_reserves");
  const r = parseNativeReserves(before);
  const [baseBalance, amaBalance, ownerValue] = await Promise.all([
    sdk.wallet.getBalance(pool.address, pool.symbol),
    sdk.wallet.getBalance(pool.address, "AMA"),
    owner ? view(sdk, pool.address, "get_lp", owner) : Promise.resolve(null),
  ]);
  const after = await view(sdk, pool.address, "get_reserves");
  if (before !== after) throw new LiquidityUnavailableError("state_changed_while_reading");
  const custodyBase = parseActualCoinBalance(baseBalance, pool.symbol);
  const custodyAma = parseActualCoinBalance(amaBalance, "AMA");
  if (custodyBase !== r.reserveBase || custodyAma !== r.reserveAma) {
    throw new LiquidityUnavailableError("custody_reserve_mismatch");
  }
  const ownerLp = ownerValue === null ? null : atomic(ownerValue, "owner_lp");
  if (ownerLp !== null && ownerLp > r.totalLp - 1000n) {
    throw new LiquidityUnavailableError("owner_lp_exceeds_supply");
  }
  return {
    symbol: pool.symbol, pair: (pool.symbol + "/AMA") as PoolSnapshot["pair"],
    address: pool.address,
    reserveBase: String(r.reserveBase), reserveAma: String(r.reserveAma),
    totalLp: String(r.totalLp), paused: r.paused,
    custodyBase: String(custodyBase), custodyAma: String(custodyAma),
    owner: owner ?? null, ownerLp: ownerLp === null ? null : String(ownerLp),
    reconciled: true,
  };
}
