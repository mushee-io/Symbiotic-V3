import { NextResponse } from "next/server";
import { AMA_NETWORK, nativeTestnetSdk } from "@/lib/amadeus";
import { requireLiquiditySymbol, require48ByteAddress } from "@/lib/liquidity/deployments";
import { readNativeTerminal } from "@/lib/terminal/read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Content-Type-Options": "nosniff",
};

/** Strictly read-only. No generic arbitrary address, query or mainnet host. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  let base: "TESTBTC" | "TESTUSD";
  let owner: string | undefined;
  try {
    base = requireLiquiditySymbol(q.get("base"));
    const ownerValue=q.get("owner");
    if (ownerValue !== null) owner=require48ByteAddress(ownerValue);
  } catch {
    return NextResponse.json({
      network:AMA_NETWORK,status:"invalid_request",market:null,
      tradingEnabled:false,
    }, { status:400,headers });
  }
  try {
    const result=await readNativeTerminal(nativeTestnetSdk(),base,owner);
    return NextResponse.json({
      network:AMA_NETWORK,status:result.status,market:result,
      tradingEnabled:false,
    },{status:200,headers});
  } catch {
    return NextResponse.json({
      network:AMA_NETWORK,status:"unavailable",market:null,
      tradingEnabled:false,
    },{status:503,headers});
  }
}
