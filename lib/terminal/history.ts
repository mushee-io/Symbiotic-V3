import { fromBase58 } from "@amadeus-protocol/sdk";
import type { AmadeusSDK } from "@amadeus-protocol/sdk";
import { LiquidityUnavailableError, require48ByteAddress, validatePoolCertificate, type PoolCertificate } from "../liquidity/deployments";
import { positiveAtomic } from "../liquidity/intent";

export const TESTNET_EXPLORER_URL = "https://testnet.explorer.ama.one" as const;
export const MAX_HISTORY_RESULTS = 20;

export type FinalizedSwapCall = Readonly<{
  hash: string;
  pair: "TESTBTC/AMA" | "TESTUSD/AMA";
  side: "BUY" | "SELL";
  height: number;
  signer: string;
  attachedSymbol: "AMA" | "TESTBTC" | "TESTUSD";
  amountInAtomic: string;
  minimumOutAtomic: string;
  explorerUrl: string;
  status: "finalized_successful_call";
  outputVerified: false;
}>;

export function validNativeTxHash(hash: unknown): hash is string {
  if (typeof hash !== "string" || hash.length > 100 ||
      !/^[1-9A-HJ-NP-Za-km-z]+$/.test(hash)) return false;
  try { return fromBase58(hash).length === 32; }
  catch { return false; }
}
export function explorerTxUrl(hash: string): string {
  if (!validNativeTxHash(hash)) throw new LiquidityUnavailableError("invalid_transaction_hash");
  return TESTNET_EXPLORER_URL + "/network/tx/" + hash;
}
export function explorerAccountUrl(address: string): string {
  return TESTNET_EXPLORER_URL + "/network/address/" + require48ByteAddress(address);
}

/** Confirms successful finalized native swap call from public testnet. 
 * NOT evidence of actual output amount; that needs M8 balance/reserve witnesses. */
export function verifyFinalizedSwapCall(
  value: unknown, candidateHash: string, pool: PoolCertificate,
  owner: string, rootedHeight: number,
): FinalizedSwapCall {
  if (!validNativeTxHash(candidateHash) ||
      !Number.isSafeInteger(rootedHeight) || rootedHeight < 0 ||
      !value || typeof value !== "object") {
    throw new LiquidityUnavailableError("invalid_swap_history_record");
  }
  const tx = value as Record<string, unknown>;
  const body = tx.tx as Record<string, unknown> | undefined;
  const action = body?.action as Record<string, unknown> | undefined;
  const meta = tx.metadata as Record<string, unknown> | undefined;
  const receipt = tx.receipt as Record<string, unknown> | undefined;
  const height = meta?.entry_height;
  if (tx.hash !== candidateHash ||
      body?.signer !== owner ||
      action?.op !== "call" ||
      action?.contract !== pool.address ||
      action?.function !== "swap_exact_in" ||
      !Array.isArray(action?.args) || action.args.length !== 2 ||
      meta?.status !== "finalized" ||
      typeof height !== "number" || !Number.isSafeInteger(height) ||
      height < 0 || height > rootedHeight ||
      receipt?.success !== true) {
    throw new LiquidityUnavailableError("transaction_not_finalized_pool_swap");
  }
  const args = action.args as unknown[];
  if (typeof args[0] !== "string" || typeof args[1] !== "string" ||
      typeof action.attached_symbol !== "string" ||
      typeof action.attached_amount !== "string") {
    throw new LiquidityUnavailableError("missing_native_attachment_witness");
  }
  const minOut = positiveAtomic(args[0], "min_out");
  const deadline = positiveAtomic(args[1], "deadline");
  if (deadline < BigInt(height) ||
      (action.attached_symbol !== "AMA" && action.attached_symbol !== pool.symbol)) {
    throw new LiquidityUnavailableError("unexpected_native_swap_attachment");
  }
  const input = positiveAtomic(action.attached_amount, "input");
  const side = action.attached_symbol === "AMA" ? "BUY" : "SELL";
  return {
    hash: candidateHash,
    pair: (pool.symbol + "/AMA") as FinalizedSwapCall["pair"],
    side,
    height,
    signer: owner,
    attachedSymbol: action.attached_symbol as FinalizedSwapCall["attachedSymbol"],
    amountInAtomic: String(input),
    minimumOutAtomic: String(minOut),
    explorerUrl: explorerTxUrl(candidateHash),
    status: "finalized_successful_call",
    outputVerified: false,
  };
}

export type HistoryReader = Pick<AmadeusSDK,"chain"|"transaction">;
/** Canonical chain history, not a self-reported client tx list. */
export async function readFinalizedWalletSwaps(
  sdk: HistoryReader, certificate: PoolCertificate, owner: string,
  rootedHeight: number,
): Promise<FinalizedSwapCall[]> {
  const pool = validatePoolCertificate(certificate, certificate.symbol);
  require48ByteAddress(owner);
  if (!Number.isSafeInteger(rootedHeight) || rootedHeight < 0) {
    throw new LiquidityUnavailableError("invalid_rooted_height");
  }
  const page = await sdk.chain.getByFilter({
    signer: owner, contract_b58: pool.address, function: "swap_exact_in",
    sort: "desc", limit: MAX_HISTORY_RESULTS,
  });
  if (!page || !Array.isArray(page.txs) || page.txs.length > MAX_HISTORY_RESULTS) {
    throw new LiquidityUnavailableError("unverified_history_page");
  }
  const seen = new Set<string>();
  const verified: FinalizedSwapCall[] = [];
  for (const candidate of page.txs) {
    const hash = candidate?.hash;
    if (!validNativeTxHash(hash) || seen.has(hash)) {
      throw new LiquidityUnavailableError("unverified_history_page");
    }
    seen.add(hash);
    const canonical = await sdk.transaction.get(hash);
    verified.push(verifyFinalizedSwapCall(canonical,hash,pool,owner,rootedHeight));
  }
  return verified.sort((a,b)=>b.height-a.height);
}
