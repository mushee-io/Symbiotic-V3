import { AmadeusSDK } from "@amadeus-protocol/sdk";
import {
  buildNativeMintCall, requireIssuer, requireM4Symbol, readTokenRegistration,
  TokenIssuanceError, type M4Symbol,
} from "./amadeus-tokens";
import { nativeTestnetSdk } from "./amadeus";
import { inspectTestnet } from "./amadeus-health";
import type { AmadeusWalletProvider } from "./amadeus-wallet";

/**
 * Native browser signing is user-approved; this does NOT accept a seed or key.
 * No background agent may call this. No auto retries after an ambiguous submit.
 */
export type SignedMint = { txHash: string; txPacked: number[] };
export function parseSignedMint(value: unknown): SignedMint {
  if (!value || typeof value !== "object") throw new TokenIssuanceError("invalid_wallet_signature");
  const signed = value as Record<string, unknown>;
  if (typeof signed.txHash !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,100}$/.test(signed.txHash)) {
    throw new TokenIssuanceError("invalid_wallet_signature");
  }
  if (!Array.isArray(signed.txPacked) || signed.txPacked.length < 8 || signed.txPacked.length > 65536 ||
      !signed.txPacked.every((v: unknown) => Number.isInteger(v) && typeof v === "number" && v >= 0 && v <= 255)) {
    throw new TokenIssuanceError("invalid_wallet_signature");
  }
  return { txHash: signed.txHash, txPacked: signed.txPacked as number[] };
}

export async function verifyNativeMint(
  sdk: Pick<AmadeusSDK, "transaction" | "contract" | "wallet">,
  symbol: M4Symbol,
  issuer: string,
  signedHash: string,
  result: unknown,
) {
  if (!result || typeof result !== "object") throw new TokenIssuanceError("unverified_receipt");
  const outcome = result as Record<string, unknown>;
  const metadata = outcome.metadata && typeof outcome.metadata === "object" ?
    outcome.metadata as Record<string, unknown> : null;
  const receipt = outcome.receipt && typeof outcome.receipt === "object" ?
    outcome.receipt as Record<string, unknown> : null;
  if (outcome.hash !== signedHash || receipt?.success !== true ||
      !metadata || !Number.isSafeInteger(metadata.entry_height) ||
      typeof metadata.entry_height !== "number" || metadata.entry_height < 0) {
    throw new TokenIssuanceError("unverified_receipt");
  }
  const tx = await sdk.transaction.get(signedHash);
  const action = tx.tx?.action;
  if (tx.hash !== signedHash || tx.tx?.signer !== issuer ||
      action?.contract !== "Coin" || action?.function !== "create_and_mint" ||
      tx.receipt?.success !== true || tx.metadata?.status !== "finalized") {
    throw new TokenIssuanceError("unverified_transaction");
  }
  const state = await readTokenRegistration(sdk, symbol);
  const expectedSupply = BigInt(buildNativeMintCall(symbol).args[1]);
  if (state.status !== "registered" || state.supplyAtomic === null ||
      BigInt(state.supplyAtomic) !== expectedSupply) {
    throw new TokenIssuanceError("unverified_supply");
  }
  const balance = await sdk.wallet.getBalance(issuer, symbol);
  const flat = balance?.balance?.flat;
  if (balance?.balance?.symbol !== symbol ||
      typeof flat !== "number" || !Number.isSafeInteger(flat) ||
      flat < 0 || BigInt(flat) !== expectedSupply) {
    throw new TokenIssuanceError("unverified_issuer_balance");
  }
  return {
    symbol,
    pair: symbol + "/AMA",
    hash: signedHash,
    height: metadata.entry_height,
    supplyAtomic: state.supplyAtomic,
    issuer,
    status: "finalized" as const,
  };
}

export type IssueTokenDeps = {
  sdk: AmadeusSDK;
  provider: AmadeusWalletProvider;
  account: string;
  network: string;
  rpcHealthy: boolean;
};

/** Call only in a direct user click handler. Transaction may be submitted once. */
export async function issueNativeTestToken(deps: IssueTokenDeps, rawSymbol: string) {
  const symbol = requireM4Symbol(rawSymbol);
  const account = requireIssuer(deps.account, deps.network, deps.rpcHealthy);
  if (!deps.provider.signTransaction) throw new TokenIssuanceError("wallet_cannot_sign");
  await inspectTestnet(deps.sdk);
  const existing = await readTokenRegistration(deps.sdk, symbol);
  if (existing.status !== "unregistered") throw new TokenIssuanceError("symbol_unavailable");
  const call = buildNativeMintCall(symbol);
  // Extension displays the exact native Coin call and requires user approval.
  const signed = parseSignedMint(await deps.provider.signTransaction(call));
  // Never submit()+submitAndWait() sequentially, which broadcasts twice.
  // The SDK is constructed with the pinned testnet URL; no mainnet fallback.
  const result = await deps.sdk.transaction.submitAndWait(
    Uint8Array.from(signed.txPacked), { finalized: true }
  );
  return verifyNativeMint(deps.sdk, symbol, account, signed.txHash, result);
}

/** Defensive factory avoids relying on the SDK's unsafe default mainnet URL. */
export function issuanceTestnetSdk() {
  return nativeTestnetSdk();
}
