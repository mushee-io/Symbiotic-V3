import { nativeTestnetSdk } from "./amadeus";
import { inspectTestnet } from "./amadeus-health";
import { isAmaAddress } from "./amadeus-wallet";

/**
 * The only authorized M4 test assets. Global native Coin symbols are unique
 * per chain, not ERC-20 addresses. Each market must always quote in AMA.
 */
export const M4_TEST_TOKENS = [
  { symbol: "TESTBTC", pair: "TESTBTC/AMA", name: "Test Bitcoin", supply: "1000000", decimals: 9 },
  { symbol: "TESTUSD", pair: "TESTUSD/AMA", name: "Test Dollar", supply: "1000000", decimals: 9 },
] as const;
export type M4Symbol = typeof M4_TEST_TOKENS[number]["symbol"];
export type TokenAvailability = "unregistered" | "registered";

export class TokenIssuanceError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "TokenIssuanceError";
  }
}

export function requireM4Symbol(value: unknown): M4Symbol {
  if (value !== "TESTBTC" && value !== "TESTUSD") {
    throw new TokenIssuanceError("token_not_allowed");
  }
  return value;
}

export function validateTokenDefinition(symbol: M4Symbol) {
  const spec = M4_TEST_TOKENS.find((token) => token.symbol === symbol);
  if (!spec || spec.pair !== symbol + "/AMA") throw new TokenIssuanceError("invalid_quote");
  if (!/^[A-Z0-9]{1,32}$/.test(spec.symbol)) throw new TokenIssuanceError("invalid_symbol");
  if (!Number.isInteger(spec.decimals) || spec.decimals !== 9) throw new TokenIssuanceError("invalid_decimals");
  if (!/^[1-9][0-9]*$/.test(spec.supply)) throw new TokenIssuanceError("invalid_supply");
  const flat = BigInt(spec.supply) * 10n ** BigInt(spec.decimals);
  const MAX_NATIVE_MINT = 1000000000000000000000000000000000000n;
  if (flat <= 0n || flat > MAX_NATIVE_MINT) throw new TokenIssuanceError("supply_overflow");
  return { ...spec, atomicSupply: flat.toString(), mintable: false, pausable: false, soulbound: false };
}

/** Exact six positional native Coin arguments from the node's Rust implementation. */
export function buildNativeMintCall(symbol: M4Symbol) {
  const spec = validateTokenDefinition(symbol);
  return {
    contract: "Coin",
    method: "create_and_mint",
    args: [spec.symbol, spec.atomicSupply, String(spec.decimals), "false", "false", "false"],
    description: "Issue " + spec.supply + " test " + spec.symbol + " (" + spec.pair + ") on Amadeus testnet",
  };
}

/** Exact raw contract state key; do not confuse absence with a 0 supply. */
export function supplyKey(symbol: M4Symbol): Uint8Array {
  requireM4Symbol(symbol);
  return new TextEncoder().encode("coin:" + symbol + ":totalSupply");
}
export function parseTotalSupply(raw: unknown): bigint | null {
  // The official /api/contract/get returns JSON null for no contract-state key.
  if (raw === null) return null;
  if (typeof raw !== "string" || !/^(0|[1-9][0-9]*)$/.test(raw)) {
    throw new TokenIssuanceError("invalid_supply_state");
  }
  const n = BigInt(raw);
  if (n < 0n || n > 170141183460469231731687303715884105727n) {
    throw new TokenIssuanceError("invalid_supply_state");
  }
  return n;
}
export type TokenReader = { contract: { get(key: Uint8Array): Promise<unknown> } };
export async function readTokenRegistration(reader: TokenReader, symbol: M4Symbol) {
  const supply = parseTotalSupply(await reader.contract.get(supplyKey(symbol)));
  return {
    symbol,
    pair: symbol + "/AMA",
    status: (supply === null ? "unregistered" : "registered") as TokenAvailability,
    supplyAtomic: supply === null ? null : supply.toString(),
  };
}

/** No signing unless connected wallet agrees that it is on testnet. */
export function requireIssuer(account: string | null, walletNetwork: string, rpcHealthy: boolean) {
  if (!isAmaAddress(account)) throw new TokenIssuanceError("issuer_not_connected");
  if (walletNetwork !== "testnet" || !rpcHealthy) {
    throw new TokenIssuanceError("testnet_wallet_not_verified");
  }
  return account;
}

/** Public SDK queries only: no funds, private keys or transactions involved. */
export async function checkNativeIssuanceStatus(symbol: M4Symbol) {
  const sdk = nativeTestnetSdk();
  await inspectTestnet(sdk);
  return readTokenRegistration(sdk, symbol);
}
