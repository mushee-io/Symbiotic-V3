import { NextResponse } from "next/server";
import { nativeTestnetSdk, AMA_NETWORK } from "@/lib/amadeus";
import { inspectTestnet } from "@/lib/amadeus-health";
import { M4_TEST_TOKENS, readTokenRegistration } from "@/lib/amadeus-tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Content-Type-Options": "nosniff",
};

/** Read-only on-chain registration check. Does not imply a mint permission. */
export async function GET() {
  try {
    const sdk = nativeTestnetSdk();
    await inspectTestnet(sdk);
    const tokens = await Promise.all(
      M4_TEST_TOKENS.map((item) => readTokenRegistration(sdk, item.symbol)),
    );
    return NextResponse.json({
      network: AMA_NETWORK,
      status: "verified_state",
      mintingEnabled: false,
      tradingEnabled: false,
      tokens,
      checkedAt: new Date().toISOString(),
    }, { status: 200, headers });
  } catch {
    // Do not treat RPC failure as available token symbols.
    return NextResponse.json({
      network: AMA_NETWORK,
      status: "unavailable",
      mintingEnabled: false,
      tradingEnabled: false,
      tokens: [],
      checkedAt: new Date().toISOString(),
    }, { status: 503, headers });
  }
}
