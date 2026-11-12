import { fromBase58 } from "@amadeus-protocol/sdk";
import { M4_TEST_TOKENS, type M4Symbol } from "../amadeus-tokens";

/** 
 * Deployment registry is deliberately EMPTY. No environment variable, random
 * address or arbitrary UI parameter can make an unverified pool appear live.
 * A separate reviewed commit with TWO authentic deployment + initialization
 * receipts and tested runtime state is required before populating either row.
 */
export type PoolCertificate = Readonly<{
  symbol: M4Symbol;
  address: string;
  deploymentTx: string;
  initializationTx: string;
  elfSha256: string;
  deploymentFinalized: true;
  initializationFinalized: true;
  runtimeTestsPassed: true;
  tokenMintFinalized: true;
  walletNetworkWitnessed: true;
  attachmentSigningVerified: true;
}>;

export const VERIFIED_POOLS: Readonly<Record<M4Symbol, PoolCertificate | null>> = {
  TESTBTC: null,
  TESTUSD: null,
};

export class LiquidityUnavailableError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "LiquidityUnavailableError";
  }
}

export function requireLiquiditySymbol(value: unknown): M4Symbol {
  if (value !== "TESTBTC" && value !== "TESTUSD") {
    throw new LiquidityUnavailableError("unsupported_pair");
  }
  return value;
}

export function require48ByteAddress(value: unknown): string {
  if (typeof value !== "string" || value.length > 100 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(value)) {
    throw new LiquidityUnavailableError("invalid_native_address");
  }
  let raw: Uint8Array;
  try { raw = fromBase58(value); }
  catch { throw new LiquidityUnavailableError("invalid_native_address"); }
  if (raw.length !== 48) throw new LiquidityUnavailableError("invalid_native_address");
  return value;
}

export function validatePoolCertificate(
  pool: PoolCertificate | null,
  symbol: M4Symbol,
): PoolCertificate {
  if (!pool) throw new LiquidityUnavailableError("pool_not_deployed");
  if (pool.symbol !== symbol ||
      !M4_TEST_TOKENS.some((asset) => asset.symbol === pool.symbol && asset.pair === symbol + "/AMA")) {
    throw new LiquidityUnavailableError("wrong_pair");
  }
  require48ByteAddress(pool.address);
  for (const txHash of [pool.deploymentTx, pool.initializationTx]) {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,100}$/.test(txHash)) {
      throw new LiquidityUnavailableError("missing_finalized_receipt");
    }
  }
  if (!/^[a-f0-9]{64}$/.test(pool.elfSha256) ||
      pool.deploymentFinalized !== true ||
      pool.initializationFinalized !== true ||
      pool.runtimeTestsPassed !== true ||
      pool.tokenMintFinalized !== true ||
      pool.walletNetworkWitnessed !== true ||
      pool.attachmentSigningVerified !== true) {
    throw new LiquidityUnavailableError("unverified_prerequisites");
  }
  return pool;
}

export function getCertifiedPool(symbol: M4Symbol): PoolCertificate {
  return validatePoolCertificate(VERIFIED_POOLS[symbol], symbol);
}

export function assertNoLiveLiquidity(): void {
  for (const symbol of ["TESTBTC", "TESTUSD"] as const) {
    if (VERIFIED_POOLS[symbol] !== null) {
      throw new LiquidityUnavailableError("unexpected_live_pool_registry");
    }
  }
}
