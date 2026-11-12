import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/liquidity/status/route";
import { AMA_TESTNET_RPC } from "../lib/amadeus";
import { toBase58 } from "@amadeus-protocol/sdk";

const owner=toBase58(new Uint8Array(48).fill(5));

async function stubFetch(
  responder: (url:string)=>Response, check:(calls:string[])=>Promise<void>,
) {
  const priorFetch=globalThis.fetch;
  const priorRpc=process.env.AMADEUS_RPC_URL;
  delete process.env.AMADEUS_RPC_URL;
  const calls:string[]=[];
  globalThis.fetch=async input=>{
    const url=input instanceof Request?input.url:String(input);
    calls.push(url);
    if(!url.startsWith(AMA_TESTNET_RPC+"/")) throw Error("unexpected network");
    return responder(url);
  };
  try { await check(calls); } finally {
    globalThis.fetch=priorFetch;
    if(priorRpc===undefined)delete process.env.AMADEUS_RPC_URL;
    else process.env.AMADEUS_RPC_URL=priorRpc;
  }
}

function healthy(url:string){
  if(url.endsWith("/chain/tip")) return Response.json({error:"ok",entry:{header:{height:1234}}});
  if(url.endsWith("/chain/stats"))return Response.json({error:"ok",stats:{height:1234,rooted_height:1233}});
  throw Error("no unverified pool storage may be queried");
}

test("unminted/undeployed pools return only blocked rows and NULL custody/LP, even with a connected owner", async()=>{
  await stubFetch(healthy, async calls=>{
    const r=await GET(new Request("https://symbiotic.example/api/liquidity/status?owner="+owner));
    assert.equal(r.status,200);
    assert.match(r.headers.get("cache-control")||"",/no-store/);
    const data=await r.json();
    assert.equal(data.status,"read_only");
    assert.equal(data.height,1234);
    assert.equal(data.tradingEnabled,false);
    assert.equal(data.liquidityEnabled,false);
    assert.deepEqual(data.pools.map((p:{pair:string})=>p.pair),["TESTBTC/AMA","TESTUSD/AMA"]);
    for(const row of data.pools){
      assert.equal(row.status,"blocked");
      assert.equal(row.state,null);
      assert.equal(row.reason,"pool_unverified_or_unavailable");
    }
    assert.equal(calls.some(s=>s.includes("/wallet/")||s.includes("/contract/")),false);
  });
});

test("invalid 48-byte owner is rejected without any network requests",async()=>{
  await stubFetch(()=>{throw Error("must not fetch");},async calls=>{
    const r=await GET(new Request("https://symbiotic.example/api/liquidity/status?owner=0xbad"));
    assert.equal(r.status,400);
    assert.equal((await r.json()).liquidityEnabled,false);
    assert.equal(calls.length,0);
  });
});

test("unavailable native RPC always rejects; no fabricated zero reserves or mainnet failover",async()=>{
  await stubFetch(()=>Response.json({error:"unavailable"},{status:503}),async calls=>{
    const r=await GET(new Request("https://symbiotic.example/api/liquidity/status"));
    assert.equal(r.status,503);
    const data=await r.json();
    assert.deepEqual(data.pools,[]);
    assert.equal(data.tradingEnabled,false);
    assert.equal(calls.every(u=>u.startsWith(AMA_TESTNET_RPC+"/")),true);
  });
});

test("misconfigured mainnet RPC fails closed before any request",async()=>{
  await stubFetch(()=>{throw Error("never call");},async calls=>{
    process.env.AMADEUS_RPC_URL="https://mainnet-rpc.ama.one/api";
    const r=await GET(new Request("https://symbiotic.example/api/liquidity/status"));
    assert.equal(r.status,503);
    assert.equal(calls.length,0);
  });
});
