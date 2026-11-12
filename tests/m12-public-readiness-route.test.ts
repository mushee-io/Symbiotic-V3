import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/demo/readiness/route";
import { AMA_TESTNET_RPC } from "../lib/amadeus";

const path="https://symbiotic.example/api/demo/readiness";
async function pinnedFetch(
  responder:(url:string)=>Response,
  verify:(urls:string[])=>Promise<void>,
){
  const originalFetch=globalThis.fetch;
  const originalRpc=process.env.AMADEUS_RPC_URL;
  delete process.env.AMADEUS_RPC_URL;
  const urls:string[]=[];
  globalThis.fetch=async input=>{
    const url=input instanceof Request?input.url:String(input);
    assert.ok(url.startsWith(AMA_TESTNET_RPC+"/"),"no other or mainnet host");
    urls.push(url);
    return responder(url);
  };
  try{await verify(urls);}
  finally{
    globalThis.fetch=originalFetch;
    if(originalRpc===undefined)delete process.env.AMADEUS_RPC_URL;
    else process.env.AMADEUS_RPC_URL=originalRpc;
  }
}
function healthy(url:string):Response{
  if(url.endsWith("/chain/tip"))
    return Response.json({error:"ok",entry:{header:{height:200}}});
  if(url.endsWith("/chain/stats"))
    return Response.json({error:"ok",stats:{height:200,rooted_height:199}});
  if(url.endsWith("/contract/get"))return Response.json(null);
  throw Error("No wallets, unsigned pools or history should be read");
}

test("M12 route reads exactly native Amadeus testnet and reports no fake mints/swaps/hosting",async()=>{
  await pinnedFetch(healthy,async urls=>{
    const response=await GET(new Request(path));
    assert.equal(response.status,200);
    assert.match(response.headers.get("cache-control")||"",/no-store/);
    const payload=await response.json();
    assert.equal(payload.network,"amadeus-testnet");
    assert.equal(payload.status,"verified_read_only_observation");
    assert.equal(payload.tradingEnabled,false);
    assert.equal(payload.signingEnabled,false);
    assert.equal(payload.readiness.status,"research_demo_only");
    assert.equal(payload.readiness.markets.length,2);
    assert.equal(payload.readiness.markets[0].pair,"TESTBTC/AMA");
    assert.equal(payload.readiness.markets[1].pair,"TESTUSD/AMA");
    assert.equal(payload.readiness.checks.testTokensIndependentlyMinted,false);
    assert.equal(payload.readiness.checks.fourFinalizedBidirectionalSwapReceiptsVerified,false);
    assert.equal(payload.readiness.checks.publicWebDeploymentVerified,false);
    assert.equal(payload.readiness.productionReady,false);
    assert.equal(urls.filter(x=>x.endsWith("/contract/get")).length,2);
    assert.equal(urls.some(x=>x.includes("/wallet/balance")||x.includes("/chain/tx")),false);
  });
});

test("M12 route rejects caller-provided RPC, contract, wallet or claimed acceptance without fetch",async()=>{
  await pinnedFetch(()=>{throw Error("no RPC expected");},async urls=>{
    for(const q of [
      "rpc=https://other.example",
      "owner=arbitrary",
      "poolAddress=fake",
      "tradingEnabled=true",
      "fakeReceipt=123",
      "ready=true",
      "base=TESTBTC",
    ]){
      const response=await GET(new Request(path+"?"+q));
      assert.equal(response.status,400);
      const data=await response.json();
      assert.equal(data.readiness,null);
      assert.equal(data.tradingEnabled,false);
      assert.equal(data.signingEnabled,false);
    }
    assert.equal(urls.length,0);
  });
});

test("M12 RPC outage never returns cached or fabricated market state",async()=>{
  await pinnedFetch(()=>Response.json({error:"down"},{status:503}),async urls=>{
    const response=await GET(new Request(path));
    assert.equal(response.status,503);
    const payload=await response.json();
    assert.equal(payload.status,"unavailable");
    assert.equal(payload.readiness,null);
    assert.equal(payload.tradingEnabled,false);
    assert.ok(urls.every(x=>x.startsWith(AMA_TESTNET_RPC+"/")));
  });
});

test("M12 explicitly rejected mainnet config never makes a network request",async()=>{
  await pinnedFetch(()=>{throw Error("no fetch permitted");},async urls=>{
    process.env.AMADEUS_RPC_URL="https://mainnet-rpc.ama.one/api";
    const response=await GET(new Request(path));
    assert.equal(response.status,503);
    assert.equal((await response.json()).readiness,null);
    assert.equal(urls.length,0);
  });
});

test("M12 API route has no POST/PUT/PATCH/DELETE signing or broadcasting surface",async()=>{
  const route=await import("../app/api/demo/readiness/route");
  for(const method of ["POST","PUT","PATCH","DELETE"]){
    assert.equal(method in route,false);
  }
});
