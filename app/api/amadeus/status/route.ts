import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Only the official Amadeus TESTNET RPC. No mainnet fallback.
const TESTNET_RPC = "https://testnet-rpc.ama.one";

export async function GET() {
  try {
    const response = await fetch(`${TESTNET_RPC}/api/chain/stats`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5500),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Amadeus testnet RPC unavailable");
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") throw new Error("Invalid Amadeus RPC response");
    const data = payload as Record<string, unknown>;
    if (data.error && data.error !== "ok") throw new Error("Amadeus RPC returned an error");
    const stats = (data.stats && typeof data.stats === "object") ?
      data.stats as Record<string, unknown> : data;
    const height = stats.height;
    if (typeof height !== "number" || !Number.isFinite(height) || height < 0) {
      throw new Error("Amadeus testnet returned no verified height");
    }
    return NextResponse.json({
      network: "Amadeus Testnet",
      reachable: true,
      height,
      checkedAt: new Date().toISOString(),
      tradingEnabled: false,
      contractsDeployed: false,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({
      network: "Amadeus Testnet",
      reachable: false,
      height: null,
      checkedAt: new Date().toISOString(),
      tradingEnabled: false,
      contractsDeployed: false,
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
