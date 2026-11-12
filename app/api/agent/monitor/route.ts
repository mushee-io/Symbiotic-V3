import { NextResponse } from "next/server";
import { AMA_NETWORK, nativeTestnetSdk } from "@/lib/amadeus";
import { require48ByteAddress, requireLiquiditySymbol } from "@/lib/liquidity/deployments";
import { parseAgentQuery } from "@/lib/agent/policy";
import { monitorAgent } from "@/lib/agent/monitor";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={
  "Cache-Control":"no-store, no-cache, must-revalidate",
  "X-Content-Type-Options":"nosniff",
};

/**
 * Read-only monitoring and deterministic HOLD audit. Public parameters only
 * tighten preview policy. No POST, wallet signing, RPC broadcast, oracle
 * override, PnL fabrication, self-trades, or mainnet fallback.
 */
export async function GET(request:Request){
  const q=new URL(request.url).searchParams;
  let symbol:"TESTBTC"|"TESTUSD";
  let owner:string|undefined;
  let policy:ReturnType<typeof parseAgentQuery>;
  try {
    symbol=requireLiquiditySymbol(q.get("base"));
    const who=q.get("owner");
    if(who!==null)owner=require48ByteAddress(who);
    policy=parseAgentQuery(q);
  } catch {
    return NextResponse.json({
      network:AMA_NETWORK,status:"invalid_request",
      terminal:null,audit:null,executionEnabled:false,
    },{status:400,headers});
  }
  try {
    const {terminal,audit}=await monitorAgent(
      nativeTestnetSdk(),symbol,owner,policy.config,policy.controls,
    );
    return NextResponse.json({
      network:AMA_NETWORK,status:"read_only",terminal,audit,
      executionEnabled:false,signingEnabled:false,
    },{status:200,headers});
  } catch {
    // Failed independent native chain reads must not return fake flat
    // market prices, trades, PnL, strategy candidate or a success audit.
    return NextResponse.json({
      network:AMA_NETWORK,status:"unavailable",
      terminal:null,audit:null,executionEnabled:false,
    },{status:503,headers});
  }
}
