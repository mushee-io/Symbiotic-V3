import { NextResponse } from "next/server";
import { AMA_NETWORK, nativeTestnetSdk } from "@/lib/amadeus";
import { readPublicDemoReadiness } from "@/lib/demo/readiness";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={
  "Cache-Control":"no-store, no-cache, must-revalidate",
  "X-Content-Type-Options":"nosniff",
};

/**
 * Read-only Amadeus native testnet evidence. No query-supplied contract,
 * RPC URL, approval flags, addresses, receipts or fabricated seed data.
 */
export async function GET(request:Request){
  const q=new URL(request.url).searchParams;
  if(q.size!==0){
    return NextResponse.json({
      network:AMA_NETWORK,status:"invalid_request",readiness:null,
      tradingEnabled:false,signingEnabled:false,
    },{status:400,headers});
  }
  try{
    const readiness=await readPublicDemoReadiness(nativeTestnetSdk());
    return NextResponse.json({
      network:AMA_NETWORK,status:"verified_read_only_observation",
      readiness,tradingEnabled:false,signingEnabled:false,
    },{status:200,headers});
  }catch{
    return NextResponse.json({
      network:AMA_NETWORK,status:"unavailable",readiness:null,
      tradingEnabled:false,signingEnabled:false,
    },{status:503,headers});
  }
}
