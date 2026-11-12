/**
 * Native Amadeus injected wallet bridge.
 * Contract drawn from the official extension integration guide / React demo.
 * No EVM adapter, private key handling, fake accounts or silent signing.
 */
export const AMADEUS_EXTENSION_URL =
  "https://chromewebstore.google.com/detail/amadeus-wallet/gigmkdnbhopbandngplohmilogilbkjn";

export interface AmadeusWalletProvider {
  isAmadeus?: boolean;
  requestAccounts(): Promise<unknown>;
  getAccount?(): Promise<unknown>;
  isConnected?(): Promise<unknown>;
  signTransaction?: (params: {
    contract: string;
    method: string;
    args: unknown[];
    description?: string;
  }) => Promise<unknown>;
  on?(event: string, listener: (value: unknown) => void): void;
  off?(event: string, listener: (value: unknown) => void): void;
  removeListener?(event: string, listener: (value: unknown) => void): void;
  // This is NOT in the documented extension API. Optional only; absence fails closed.
  getNetwork?: () => Promise<unknown>;
}

export function findAmadeusProvider(value: unknown): AmadeusWalletProvider | null {
  if (!value || typeof value !== "object") return null;
  const provider = value as Partial<AmadeusWalletProvider>;
  if (provider.isAmadeus !== true || typeof provider.requestAccounts !== "function") return null;
  return provider as AmadeusWalletProvider;
}

const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{40,100}$/;

/** Only public Base58 addresses; never accept arbitrary strings or seed material. */
export function isAmaAddress(value: unknown): value is string {
  return typeof value === "string" && BASE58_ADDRESS.test(value);
}

export class WalletConnectionError extends Error {
  constructor(public code: "invalid_accounts" | "rejected") {
    super(code === "rejected" ? "Wallet connection was not approved." : "Wallet returned no valid public account.");
    this.name = "WalletConnectionError";
  }
}

export async function requestAmaAccount(provider: AmadeusWalletProvider): Promise<string> {
  let response: unknown;
  try {
    response = await provider.requestAccounts();
  } catch {
    throw new WalletConnectionError("rejected");
  }
  if (!Array.isArray(response) || !isAmaAddress(response[0])) {
    throw new WalletConnectionError("invalid_accounts");
  }
  return response[0];
}

export function accountFromWalletEvent(value: unknown): string | null {
  if (!Array.isArray(value) || !isAmaAddress(value[0])) return null;
  return value[0];
}

export type WalletNetworkState = "testnet" | "wrong_network" | "unverified";

/**
 * The official wallet bridge currently documents no getNetwork method.
 * An undocumented optional provider capability may be checked, but never
 * infer testnet from RPC reachability or a successful requestAccounts().
 */
export async function checkWalletNetwork(
  provider: AmadeusWalletProvider,
): Promise<WalletNetworkState> {
  if (typeof provider.getNetwork !== "function") return "unverified";
  try {
    const raw: unknown = await provider.getNetwork();
    let network: unknown = raw;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const data = raw as Record<string, unknown>;
      network = data.network ?? data.name;
    }
    if (network === "amadeus-testnet" || network === "testnet") return "testnet";
    if (typeof network === "string" && network.trim()) return "wrong_network";
  } catch {
    // An exception never gives permission to sign.
  }
  return "unverified";
}

export function signingReadiness(
  provider: AmadeusWalletProvider | null,
  account: string | null,
  network: WalletNetworkState,
  rpcHealthy: boolean,
): boolean {
  return Boolean(
    provider &&
    typeof provider.signTransaction === "function" &&
    isAmaAddress(account) &&
    network === "testnet" &&
    rpcHealthy
  );
}
