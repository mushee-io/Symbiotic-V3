import { NextResponse } from "next/server";
import { AMA_NETWORK, nativeTestnetSdk } from "@/lib/amadeus";
import { inspectTestnet } from "@/lib/amadeus-health";
import { getCertifiedPool, require48ByteAddress } from "@/lib/liquidity/deployments";
import { reconcileNativePool } from "@/lib/liquidity/read";
import { positiveAtomic } from "@/lib/liquidity/intent";
import { quoteNativeSpot, requireSpotSide, validateSlippageBps } from "@/lib/spot/quote";
import { requireLiquiditySymbol } from "@/lib/liquidity/deployments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Content-Type-Options": "nosniff",
};

/** HTTP GET only; never signs, broadcasts or substitutes synthetic prices. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  let base: "TESTBTC" | "TESTUSD";
  let side: "BUY" | "SELL";
  let amount: string;
  let slippageBps: number;
  const owner = params.get("owner");
  try {
    base = requireLiquiditySymbol(params.get("base"));
    side = requireSpotSide(params.get("side"));
    amount = String(positiveAtomic(params.get("amount"), "swap_input"));
    const bps = params.get("slippageBps");
    if (!bps || !/^[1-9][0-9]{0,2}$/.test(bps)) throw new Error("invalid_slippage");
    slippageBps = validateSlippageBps(Number(bps));
    if (owner !== null) require48ByteAddress(owner);
  } catch {
    return NextResponse.json({
      network: AMA_NETWORK, status: "invalid_request",
      quote: null, snapshot: null, tradingEnabled: false,
    }, { status: 400, headers });
  }

  try {
    const sdk = nativeTestnetSdk();
    const tip = await inspectTestnet(sdk);
    // A healthy chain tip means NOTHING about contract deployment or funding.
    // The current reviewed M7 registry has both pool certificates = null.
    const certificate = getCertifiedPool(base);
    const snapshot = await reconcileNativePool(sdk, certificate, owner ?? undefined);
    const quote = quoteNativeSpot(snapshot, side, amount, slippageBps);
    return NextResponse.json({
      network: AMA_NETWORK, status: "quoted_read_only",
      quote, snapshot, height: tip.height, checkedAt: tip.checkedAt,
      tradingEnabled: false,
    }, { status: 200, headers });
  } catch (error) {
    if (error instanceof Error && error.message === "pool_not_deployed") {
      return NextResponse.json({
        network: AMA_NETWORK, status: "blocked",
        reason: "pool_not_deployed_or_funded", quote: null, snapshot: null,
        tradingEnabled: false,
      }, { status: 200, headers });
    }
    // Unverified custody, unrooted chain, RPC errors, stale storage, math
    // errors or unsupported endpoint all fail closed without showing a quote.
    return NextResponse.json({
      network: AMA_NETWORK, status: "unavailable",
      quote: null, snapshot: null, tradingEnabled: false,
    }, { status: 503, headers });
  }
}
