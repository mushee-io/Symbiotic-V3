import { NextResponse } from "next/server";
import { nativeTestnetSdk, AMA_NETWORK, UnsafeRpcConfigError } from "@/lib/amadeus";
import { inspectTestnet, InvalidChainDataError } from "@/lib/amadeus-health";
import { isAmaAddress } from "@/lib/amadeus-wallet";
import { parseAmaBalance, InvalidWalletBalanceError } from "@/lib/ama-balance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Content-Type-Options": "nosniff",
};

/**
 * Read-only AMA balance from the explicit native testnet SDK.
 * Public address input only. No seed/key fields, fallback, trading or signing.
 */
export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address");
  if (!isAmaAddress(address)) {
    return NextResponse.json(
      { status: "invalid_address", network: AMA_NETWORK, balance: null },
      { status: 400, headers },
    );
  }
  try {
    const sdk = nativeTestnetSdk();
    await inspectTestnet(sdk);
    const balance = parseAmaBalance(
      await sdk.wallet.getBalance(address, "AMA"),
      address,
    );
    return NextResponse.json(
      { status: "connected", ...balance },
      { status: 200, headers },
    );
  } catch (error: unknown) {
    const reason =
      error instanceof UnsafeRpcConfigError ? "unsafe_rpc_config" :
      error instanceof InvalidChainDataError ? "invalid_chain_data" :
      error instanceof InvalidWalletBalanceError ? "invalid_balance" :
      "rpc_unavailable";
    return NextResponse.json(
      { status: "unavailable", network: AMA_NETWORK, balance: null, reason },
      { status: 503, headers },
    );
  }
}
