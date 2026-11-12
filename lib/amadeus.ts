import { AmadeusSDK } from "@amadeus-protocol/sdk";

/** No alternate host or mainnet fallback is permitted in the testnet application. */
export const AMA_TESTNET_RPC = "https://testnet-rpc.ama.one/api";
export const AMA_NETWORK = "amadeus-testnet" as const;

export class UnsafeRpcConfigError extends Error {
  constructor() {
    super("Only the configured Amadeus public testnet RPC is permitted");
    this.name = "UnsafeRpcConfigError";
  }
}

/**
 * Accept exactly the approved origin + path; a missing variable is safe.
 * An explicitly blank, mainnet, HTTP, or alternate URL is a hard error.
 */
export function resolveTestnetRpc(
  configuredUrl: string | undefined = process.env.AMADEUS_RPC_URL,
): string {
  if (configuredUrl === undefined) return AMA_TESTNET_RPC;
  if (configuredUrl !== AMA_TESTNET_RPC) throw new UnsafeRpcConfigError();
  return AMA_TESTNET_RPC;
}

/** Every SDK instance is constructed with an explicit testnet URL. */
export function nativeTestnetSdk(
  configuredUrl: string | undefined = process.env.AMADEUS_RPC_URL,
): AmadeusSDK {
  return new AmadeusSDK({
    baseUrl: resolveTestnetRpc(configuredUrl),
    timeout: 6000,
  });
}
