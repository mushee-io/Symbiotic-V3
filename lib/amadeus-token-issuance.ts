import { AmadeusSDK } from "@amadeus-protocol/sdk";
import {
  buildNativeMintCall, requireIssuer, requireM4Symbol, readTokenRegistration,
  TokenIssuanceError, type M4Symbol,
} from "./amadeus-tokens";
import { nativeTestnetSdk } from "./amadeus";
import { inspectTestnet } from "./amadeus-health";
import { isAmaAddress, type AmadeusWalletProvider } from "./amadeus-wallet";
import { verifyExactTestnetSignedCall } from "./wallet/verify-testnet-signature";

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

/**
 * This narrowly permits an M4 native Coin mint with USER approval and exact
 * cryptographic testnet domain proof. It DOES NOT waive M3 two-wallet
 * acceptance or authorize any swap, LP deposit, deploy, or other signer.
 * No network or amount from a URL may change the call.
 */
export async function issueNativeTestToken(deps: IssueTokenDeps, rawSymbol: string) {
  const symbol = requireM4Symbol(rawSymbol);
  if (!isAmaAddress(deps.account)) throw new TokenIssuanceError("issuer_not_connected");
  if (!deps.rpcHealthy || deps.network === "wrong_network") {
    throw new TokenIssuanceError("testnet_wallet_not_verified");
  }
  if (typeof deps.provider.signTransaction !== "function") {
    throw new TokenIssuanceError("wallet_cannot_sign");
  }
  // If the provider can identify the currently active account, reject a
  // stale/changed account BEFORE requesting any approval. Failure is closed.
  if (typeof deps.provider.getAccount === "function") {
    let current: unknown;
    try { current = await deps.provider.getAccount(); }
    catch { throw new TokenIssuanceError("wallet_account_unverified"); }
    if (current !== deps.account) throw new TokenIssuanceError("wallet_account_changed");
  }
  await inspectTestnet(deps.sdk);
  const existing = await readTokenRegistration(deps.sdk, symbol);
  if (existing.status !== "unregistered") throw new TokenIssuanceError("symbol_unavailable");
  const call = buildNativeMintCall(symbol);

  // The official extension, not Symbiotic, controls the wallet and approval.
  // When the extension is on MAINNET it produces the wrong BLS DST and the
  // signed payload is rejected locally without ever reaching any RPC.
  const rawSigned = await deps.provider.signTransaction(call);
  const signed = verifyExactTestnetSignedCall(rawSigned, deps.account, call);

  // Exactly one submission to the PINNED Amadeus public testnet RPC. A
  // timeout or ambiguous response is NOT an invitation to resend.
  const result = await deps.sdk.transaction.submitAndWait(
    signed.txPacked, { finalized: true },
  );
  if (result.hash !== signed.txHash || result.receipt?.success !== true) {
    throw new TokenIssuanceError("unverified_receipt");
  }
  const proof = await verifyNativeMint(deps.sdk, symbol, deps.account, signed.txHash, result);
  const health = await inspectTestnet(deps.sdk);
  if (health.rootedHeight < proof.height) {
    throw new TokenIssuanceError("mint_not_independently_rooted");
  }
  return proof;
}

/** Defensive factory avoids relying on the SDK's unsafe default mainnet URL. */
export function issuanceTestnetSdk() {
  return nativeTestnetSdk();
}
