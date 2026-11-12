import type { AmadeusSDK } from "@amadeus-protocol/sdk";
import { require48ByteAddress, LiquidityUnavailableError } from "../liquidity/deployments";
import { parseActualCoinBalance, type PoolSnapshot } from "../liquidity/read";
import { quoteNativeSpot } from "./quote";
import type { NativeSpotIntent } from "./intent";

export type TraderCoinBalances = Readonly<{
  owner: string;
  baseSymbol: "TESTBTC" | "TESTUSD";
  baseAtomic: string; amaAtomic: string;
  source: "native_testnet_coin";
}>;

/** Real wallet balances from pinned Amadeus testnet, not local state. */
export async function readTraderCoinBalances(
  sdk: Pick<AmadeusSDK, "wallet">,
  owner: string, baseSymbol: "TESTBTC" | "TESTUSD",
): Promise<TraderCoinBalances> {
  require48ByteAddress(owner);
  if (baseSymbol !== "TESTBTC" && baseSymbol !== "TESTUSD") {
    throw new LiquidityUnavailableError("unsupported_pair");
  }
  const [base, ama] = await Promise.all([
    sdk.wallet.getBalance(owner, baseSymbol),
    sdk.wallet.getBalance(owner, "AMA"),
  ]);
  return {
    owner, baseSymbol,
    baseAtomic: String(parseActualCoinBalance(base, baseSymbol)),
    amaAtomic: String(parseActualCoinBalance(ama, "AMA")),
    source: "native_testnet_coin",
  };
}

function ensurePool(state: PoolSnapshot, intent: NativeSpotIntent) {
  if (state.reconciled !== true || state.pair !== intent.pair ||
      state.address !== intent.contract ||
      state.custodyBase !== state.reserveBase ||
      state.custodyAma !== state.reserveAma ||
      state.paused !== false ||
      state.owner !== intent.signer ||
      state.ownerLp === null) {
    throw new LiquidityUnavailableError("swap_snapshot_not_reconciled");
  }
}

/**
 * No wallet signing or submission here. This accepts independent on-chain
 * observations of a truly finalized native tx and reconciled before/after
 * storage, Coin custody and wallet holdings. Never synthesize fill receipts.
 */
export async function verifyFinalizedNativeSwap(
  sdk: Pick<AmadeusSDK, "transaction">,
  signedHash: string,
  intent: NativeSpotIntent,
  before: PoolSnapshot,
  after: PoolSnapshot,
  walletBefore: TraderCoinBalances,
  walletAfter: TraderCoinBalances,
) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,100}$/.test(signedHash) ||
      intent.walletApprovalRequired !== true ||
      intent.broadcastEnabled !== false ||
      intent.method !== "swap_exact_in" ||
      intent.attachments.length !== 1) {
    throw new LiquidityUnavailableError("invalid_swap_witness");
  }
  ensurePool(before, intent);
  ensurePool(after, intent);
  if (walletBefore.owner !== intent.signer || walletAfter.owner !== intent.signer ||
      walletBefore.baseSymbol !== before.symbol || walletAfter.baseSymbol !== before.symbol ||
      walletBefore.source !== "native_testnet_coin" ||
      walletAfter.source !== "native_testnet_coin") {
    throw new LiquidityUnavailableError("unverified_trader_balance_source");
  }

  const tx = await sdk.transaction.get(signedHash);
  const action = tx.tx?.action;
  if (tx.hash !== signedHash ||
      tx.receipt?.success !== true ||
      tx.metadata?.status !== "finalized" ||
      !Number.isSafeInteger(tx.metadata?.entry_height) ||
      tx.metadata.entry_height < intent.quoteAtHeight ||
      tx.metadata.entry_height > intent.deadlineHeight ||
      tx.tx?.signer !== intent.signer ||
      action?.op !== "call" ||
      action?.contract !== intent.contract ||
      action?.function !== "swap_exact_in" ||
      !Array.isArray(action?.args) ||
      action.args.length !== 2 ||
      action.args[0] !== intent.minimumOut ||
      action.args[1] !== String(intent.deadlineHeight) ||
      action.attached_symbol !== intent.attachments[0].symbol ||
      action.attached_amount !== intent.attachments[0].amount) {
    throw new LiquidityUnavailableError("unverified_native_swap_receipt");
  }
  const quoted = quoteNativeSpot(before, intent.side, intent.attachments[0].amount, intent.slippageBps);
  if (quoted.poolAddress !== intent.contract ||
      quoted.inputSymbol !== intent.attachments[0].symbol ||
      quoted.minimumOut !== intent.minimumOut ||
      quoted.expectedOut !== intent.expectedOut) {
    throw new LiquidityUnavailableError("swap_quote_mismatch");
  }

  const baseDelta = BigInt(after.reserveBase) - BigInt(before.reserveBase);
  const amaDelta = BigInt(after.reserveAma) - BigInt(before.reserveAma);
  const isBuy = intent.side === "BUY";
  const inAmount = BigInt(intent.attachments[0].amount);
  const expectedOut = BigInt(intent.expectedOut);
  const expectedBaseDelta = isBuy ? -expectedOut : inAmount;
  const expectedAmaDelta = isBuy ? inAmount : -expectedOut;
  if (baseDelta !== expectedBaseDelta || amaDelta !== expectedAmaDelta ||
      after.totalLp !== before.totalLp ||
      after.ownerLp !== before.ownerLp ||
      BigInt(after.reserveBase) * BigInt(after.reserveAma) <
      BigInt(before.reserveBase) * BigInt(before.reserveAma)) {
    throw new LiquidityUnavailableError("swap_reserve_or_lp_reconciliation_failed");
  }

  const userBaseDelta = BigInt(walletAfter.baseAtomic) - BigInt(walletBefore.baseAtomic);
  const userAmaDelta = BigInt(walletAfter.amaAtomic) - BigInt(walletBefore.amaAtomic);
  // AMA is also the native transaction-fee asset: account for >= fee paid on
  // BUY, or <= gross AMA received on SELL. Base changes must match exactly.
  if (userBaseDelta !== (isBuy ? expectedOut : -inAmount) ||
      (isBuy ? userAmaDelta > -inAmount : userAmaDelta > expectedOut)) {
    throw new LiquidityUnavailableError("trader_coin_balances_do_not_reconcile");
  }

  return {
    status: "finalized_and_reconciled" as const,
    hash: signedHash, height: tx.metadata.entry_height,
    pair: intent.pair, side: intent.side,
    spent: intent.attachments[0].amount,
    received: intent.expectedOut, outputSymbol: quoted.outputSymbol,
    reserveBaseDelta: baseDelta.toString(),
    reserveAmaDelta: amaDelta.toString(),
    traderBaseDelta: userBaseDelta.toString(),
    traderAmaDelta: userAmaDelta.toString(),
  };
}
