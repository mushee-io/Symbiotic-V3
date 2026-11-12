import { AmadeusSDK } from "@amadeus-protocol/sdk";
export const AMA_TESTNET_RPC = "https://testnet-rpc.ama.one/api";
export function nativeTestnetSdk() {
  const baseUrl = process.env.AMADEUS_RPC_URL || AMA_TESTNET_RPC;
  if (baseUrl !== AMA_TESTNET_RPC) throw new Error("Amadeus testnet RPC only; no mainnet fallback");
  return new AmadeusSDK({baseUrl,timeout:10000});
}
