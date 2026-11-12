import { AMA_NETWORK } from "./amadeus";

type UnknownRecord = Record<string, unknown>;

export class InvalidChainDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidChainDataError";
  }
}

export type TestnetHealth = {
  status: "connected";
  network: typeof AMA_NETWORK;
  height: number;
  statsHeight: number;
  rootedHeight: number;
  checkedAt: string;
};

export type ChainReader = {
  chain: {
    getTip(): Promise<unknown>;
    getStats(): Promise<unknown>;
  };
};

function asRecord(value: unknown, description: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidChainDataError("Invalid " + description);
  }
  return value as UnknownRecord;
}

/** Accept the wire format's integer or decimal string; reject NaN, exponents, floats, and overflow. */
export function asHeight(value: unknown, label: string): number {
  if (
    typeof value !== "number" &&
    !(typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value))
  ) {
    throw new InvalidChainDataError("Invalid " + label);
  }
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new InvalidChainDataError("Invalid " + label);
  }
  return n;
}

/**
 * A healthy RPC must return BOTH a valid native chain tip and coherent
 * chain stats. Do not infer exchange readiness, asset issuance, or network
 * identity from a successful chain-tip read.
 */
export async function inspectTestnet(sdk: ChainReader): Promise<TestnetHealth> {
  const [tipPayload, statsPayload] = await Promise.all([
    sdk.chain.getTip(),
    sdk.chain.getStats(),
  ]);
  const tip = asRecord(tipPayload, "tip response");
  const entry = asRecord(tip.entry, "tip entry");
  const header = asRecord(entry.header, "tip header");
  const statsResponse = asRecord(statsPayload, "stats response");
  const stats = asRecord(statsResponse.stats, "stats");
  const height = asHeight(header.height, "tip height");
  const statsHeight = asHeight(stats.height, "stats height");
  const rootedHeight = asHeight(stats.rooted_height, "rooted height");

  if (rootedHeight > statsHeight) {
    throw new InvalidChainDataError("Rooted height is above stats height");
  }
  // The two endpoints are sampled concurrently and can differ by new blocks.
  return {
    status: "connected",
    network: AMA_NETWORK,
    height,
    statsHeight,
    rootedHeight,
    checkedAt: new Date().toISOString(),
  };
}
