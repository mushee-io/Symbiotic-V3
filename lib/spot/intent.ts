import { getCertifiedPool, require48ByteAddress, LiquidityUnavailableError } from "../liquidity/deployments";
import { deadlineAt, positiveAtomic, type NativeCoinAttachment } from "../liquidity/intent";
import type { PoolSnapshot } from "../liquidity/read";
import { assertVerifiedSpotPool, quoteNativeSpot, type NativeSpotQuote, type SpotSide } from "./quote";

/**
 * These flags must NOT be inferred from RPC health or compiled contract ELFs.
 * Only independently witnessed two-wallet M3, finalized token M4, deployed M6,
 * funded M7 and signed native attachment tests may authorize later activation.
 */
export const VERIFIED_SWAP_ACCEPTANCE = {
  TESTBTC: null,
  TESTUSD: null,
} as const;

export function requireRealSwapAcceptance(symbol: "TESTBTC" | "TESTUSD"): never {
  getCertifiedPool(symbol); // M3–M6 deployment certificate missing on current chain
  void VERIFIED_SWAP_ACCEPTANCE[symbol]; // M7 + M8 live witness is not supplied
  throw new LiquidityUnavailableError("real_swap_acceptance_missing");
}

export type NativeSpotIntent = Readonly<{
  pair: "TESTBTC/AMA" | "TESTUSD/AMA";
  side: SpotSide;
  signer: string; contract: string;
  method: "swap_exact_in";
  args: readonly [string, string];
  attachments: readonly [NativeCoinAttachment];
  expectedOut: string; minimumOut: string;
  quoteAtHeight: number; deadlineHeight: number;
  feeBps: 30; slippageBps: number;
  walletApprovalRequired: true;
  broadcastEnabled: false;
}>;

export function buildNativeSpotIntent(
  state: PoolSnapshot,
  signer: string,
  side: SpotSide,
  inputAtomic: string,
  slippageBps: number,
  quoteAtHeight: number,
  currentHeight: number,
  deadlineHeight: number,
  displayedQuote?: NativeSpotQuote,
): NativeSpotIntent {
  assertVerifiedSpotPool(state);
  require48ByteAddress(signer);
  if (state.owner !== signer || state.ownerLp === null) {
    throw new LiquidityUnavailableError("wallet_snapshot_not_bound");
  }
  if (!Number.isSafeInteger(quoteAtHeight) || quoteAtHeight < 0 ||
      !Number.isSafeInteger(currentHeight) || currentHeight < quoteAtHeight ||
      currentHeight - quoteAtHeight > 3) {
    throw new LiquidityUnavailableError("stale_native_quote");
  }
  if (deadlineHeight > currentHeight + 20) {
    throw new LiquidityUnavailableError("deadline_too_far");
  }
  const deadline = deadlineAt(currentHeight, deadlineHeight);
  const amount = positiveAtomic(inputAtomic, "swap_input");
  const quote = quoteNativeSpot(state, side, String(amount), slippageBps);
  if (displayedQuote && (
    displayedQuote.pair !== quote.pair ||
    displayedQuote.poolAddress !== state.address ||
    displayedQuote.side !== side ||
    displayedQuote.amountIn !== quote.amountIn ||
    displayedQuote.expectedOut !== quote.expectedOut ||
    displayedQuote.minimumOut !== quote.minimumOut ||
    displayedQuote.reserveBase !== state.reserveBase ||
    displayedQuote.reserveAma !== state.reserveAma ||
    displayedQuote.feeBps !== 30 ||
    displayedQuote.slippageBps !== slippageBps
  )) {
    throw new LiquidityUnavailableError("quote_changed_reprice");
  }
  return {
    pair: quote.pair, side,
    signer, contract: state.address, method: "swap_exact_in",
    args: [quote.minimumOut, deadline],
    attachments: [{ symbol: quote.inputSymbol, amount: quote.amountIn }],
    expectedOut: quote.expectedOut, minimumOut: quote.minimumOut,
    quoteAtHeight, deadlineHeight, feeBps: 30, slippageBps,
    walletApprovalRequired: true, broadcastEnabled: false,
  };
}

/**
 * Amadeus extension's documented signTransaction method has no Coin attachment
 * field or authoritative testnet network attestation. Cannot correctly sign
 * a native swap, so never invoke that wallet API and never submit/broadcast.
 */
export function requireAttachmentAwareSwapWallet(_provider: unknown): never {
  throw new LiquidityUnavailableError("native_wallet_swap_attachment_signing_unverified");
}
