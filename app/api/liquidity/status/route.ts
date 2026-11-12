import { NextResponse } from "next/server";
import { nativeTestnetSdk, AMA_NETWORK } from "@/lib/amadeus";
import { inspectTestnet } from "@/lib/amadeus-health";
import { require48ByteAddress, getCertifiedPool } from "@/lib/liquidity/deployments";
import { reconcileNativePool } from "@/lib/liquidity/read";
import { M4_TEST_TOKENS } from "@/lib/amadeus-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Content-Type-Options": "nosniff",
};

/** No signing, deployment, minting or mocked balances on this endpoint. */
export async function GET(request: Request) {
  const owner = new URL(request.url).searchParams.get("owner");
  if (owner !== null) {
    try { require48ByteAddress(owner); }
    catch {
      return NextResponse.json(
        { network: AMA_NETWORK, status: "invalid_owner", pools: [], tradingEnabled: false, liquidityEnabled: false },
        { status: 400, headers },
      );
    }
  }
  try {
    const sdk = nativeTestnetSdk();
    const health = await inspectTestnet(sdk);
    const pools = await Promise.all(M4_TEST_TOKENS.map(async ({ symbol, pair }) => {
      try {
        const certificate = getCertifiedPool(symbol);
        const state = await reconcileNativePool(sdk, certificate, owner ?? undefined);
        return { symbol, pair, status: "reconciled" as const, reason: null, state };
      } catch {
        // If configured but unavailable, show NO stored or historical reserves.
        return { symbol, pair, status: "blocked" as const, reason: "pool_unverified_or_unavailable", state: null };
      }
    }));
    return NextResponse.json({
      network: AMA_NETWORK, status: "read_only", height: health.height,
      pools, tradingEnabled: false, liquidityEnabled: false,
      checkedAt: new Date().toISOString(),
    }, { status: 200, headers });
  } catch {
    return NextResponse.json({
      network: AMA_NETWORK, status: "unavailable", pools: [],
      tradingEnabled: false, liquidityEnabled: false,
    }, { status: 503, headers });
  }
}
