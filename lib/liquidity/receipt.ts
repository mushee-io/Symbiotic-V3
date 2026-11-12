import type { AmadeusSDK } from "@amadeus-protocol/sdk";
import { LiquidityUnavailableError } from "./deployments";
import type { LiquidityIntent } from "./intent";
import type { PoolSnapshot } from "./read";

/**
 * Post-transaction independently read ledger snapshots must be captured with
 * reconcileNativePool. A hash or wallet approval ALONE is not mint/deposit
 * evidence. This function never submits or signs transactions.
 */
export async function verifyFinalizedLiquidityReceipt(
  sdk: Pick<AmadeusSDK, "transaction">,
  signedHash: string,
  intent: LiquidityIntent,
  before: PoolSnapshot,
  after: PoolSnapshot,
) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,100}$/.test(signedHash)) {
    throw new LiquidityUnavailableError("invalid_transaction_hash");
  }
  const tx = await sdk.transaction.get(signedHash);
  if (tx.hash !== signedHash ||
      tx.receipt?.success !== true ||
      tx.metadata?.status !== "finalized" ||
      !Number.isSafeInteger(tx.metadata?.entry_height) ||
      tx.tx?.signer !== intent.signer ||
      tx.tx?.action?.contract !== intent.contract ||
      tx.tx.action.function !== intent.method ||
      tx.tx.action.op !== "call" ||
      !Array.isArray(tx.tx.action.args) ||
      tx.tx.action.args.length !== intent.args.length ||
      tx.tx.action.args.some((a, i) => a !== intent.args[i])) {
    throw new LiquidityUnavailableError("unverified_native_receipt");
  }
  if (before.reconciled !== true || after.reconciled !== true ||
      before.owner !== intent.signer || after.owner !== intent.signer ||
      before.address !== intent.contract || after.address !== intent.contract ||
      before.pair !== intent.pair || after.pair !== intent.pair ||
      before.symbol !== after.symbol ||
      before.custodyBase !== before.reserveBase ||
      after.custodyBase !== after.reserveBase ||
      before.custodyAma !== before.reserveAma ||
      after.custodyAma !== after.reserveAma ||
      before.ownerLp === null || after.ownerLp === null) {
    throw new LiquidityUnavailableError("unreconciled_liquidity_state");
  }
  const bn = (v: string) => BigInt(v);
  const baseDelta = bn(after.reserveBase) - bn(before.reserveBase);
  const amaDelta = bn(after.reserveAma) - bn(before.reserveAma);
  const supplyDelta = bn(after.totalLp) - bn(before.totalLp);
  const ownerDelta = bn(after.ownerLp) - bn(before.ownerLp);
  const sign = intent.method === "add_liquidity" ? 1n : -1n;
  if (baseDelta !== sign * bn(intent.expected.base) ||
      amaDelta !== sign * bn(intent.expected.ama) ||
      supplyDelta !== sign * bn(intent.expected.lp) ||
      ownerDelta !== sign * bn(intent.expected.lp) ||
      before.paused !== after.paused) {
    throw new LiquidityUnavailableError("unverified_lp_or_reserve_change");
  }
  return {
    status: "finalized_and_reconciled" as const,
    hash: signedHash, pair: intent.pair,
    operation: intent.method, height: tx.metadata.entry_height,
    changeBase: baseDelta.toString(), changeAma: amaDelta.toString(),
    changeLp: supplyDelta.toString(),
  };
}
