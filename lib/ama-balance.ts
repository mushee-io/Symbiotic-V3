import { isAmaAddress } from "./amadeus-wallet";

export class InvalidWalletBalanceError extends Error {
  constructor() {
    super("Invalid native AMA balance response");
    this.name = "InvalidWalletBalanceError";
  }
}

export type VerifiedAmaBalance = {
  symbol: "AMA";
  amount: string;
  address: string;
  network: "amadeus-testnet";
  checkedAt: string;
};

/**
 * Parse the official SDK balance envelope, rejecting negative/NaN/unknown
 * symbols. Never substitute zeros on errors.
 */
export function parseAmaBalance(payload: unknown, address: string): VerifiedAmaBalance {
  if (!isAmaAddress(address)) throw new InvalidWalletBalanceError();
  if (!payload || typeof payload !== "object") throw new InvalidWalletBalanceError();
  const candidate = (payload as Record<string, unknown>).balance;
  if (!candidate || typeof candidate !== "object") throw new InvalidWalletBalanceError();
  const value = candidate as Record<string, unknown>;
  if (value.symbol !== "AMA" ||
      typeof value.float !== "number" ||
      !Number.isFinite(value.float) ||
      value.float < 0 ||
      typeof value.flat !== "number" ||
      !Number.isFinite(value.flat) ||
      value.flat < 0) throw new InvalidWalletBalanceError();
  return {
    symbol: "AMA",
    amount: String(value.float),
    address,
    network: "amadeus-testnet",
    checkedAt: new Date().toISOString(),
  };
}
