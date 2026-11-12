import { NextResponse } from "next/server";
import { nativeTestnetSdk, UnsafeRpcConfigError, AMA_NETWORK } from "@/lib/amadeus";
import { inspectTestnet, InvalidChainDataError } from "@/lib/amadeus-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Content-Type-Options": "nosniff",
};

/**
 * Testnet connectivity only. A healthy chain does NOT mean spot pools,
 * wallets or swaps have been deployed.
 */
export async function GET() {
  try {
    const health = await inspectTestnet(nativeTestnetSdk());
    return NextResponse.json(
      { ...health, tradingEnabled: false, contractsVerified: false },
      { status: 200, headers },
    );
  } catch (error: unknown) {
    let reason = "rpc_unavailable";
    if (error instanceof UnsafeRpcConfigError) reason = "unsafe_rpc_config";
    else if (error instanceof InvalidChainDataError) reason = "invalid_chain_data";
    else if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 408
    ) reason = "rpc_timeout";
    // Never expose secrets, stack traces, request bodies or upstream messages.
    return NextResponse.json(
      {
        network: AMA_NETWORK,
        status: "unavailable",
        height: null,
        statsHeight: null,
        rootedHeight: null,
        checkedAt: new Date().toISOString(),
        reason,
        tradingEnabled: false,
        contractsVerified: false,
      },
      { status: 503, headers },
    );
  }
}
