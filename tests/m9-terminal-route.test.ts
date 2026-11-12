import test from "node:test";
import assert from "node:assert/strict";
import {toBase58} from "@amadeus-protocol/sdk";
import {GET} from "../app/api/terminal/status/route";
import {AMA_TESTNET_RPC} from "../lib/amadeus";

const OWNER=toBase58(new Uint8Array(48).fill(5));
const baseUrl="https://symbiotic.example/api/terminal/status";
function request(base="TESTBTC",owner?:string){
  const q=new URLSearchParams({base});
  if(owner!==undefined)q.set("owner",owner);
  return new Request(baseUrl+"?"+q.toString());
}
async function withRpc(
  responder:(url:string)=>Response,
  check:(requests:string[])=>Promise<void>,
){
  const oldFetch=globalThis.fetch;
  const oldRpc=process.env.AMADEUS_RPC_URL;
  delete process.env.AMADEUS_RPC_URL;
  const calls:string[]=[];
  globalThis.fetch=async (req)=>{
    const url=req instanceof Request?req.url:String(req);
    assert.ok(url.startsWith(AMA_TESTNET_RPC+"/"),"unexpected or mainnet RPC");
    calls.push(url);
    return responder(url);
  };
  try{await check(calls);}finally{
    globalThis.fetch=oldFetch;
    if(oldRpc===undefined)delete process.env.AMADEUS_RPC_URL;
    else process.env.AMADEUS_RPC_URL=oldRpc;
  }
}
function healthy(url:string):Response{
  if(url.endsWith("/chain/tip"))
    return Response.json({error:"ok",entry:{header:{height:9000}}});
  if(url.endsWith("/chain/stats"))
    return Response.json({error:"ok",stats:{height:9000,rooted_height:8999}});
  if(url.endsWith("/contract/get"))return Response.json(null);
  if(url.includes("/wallet/balance/"))return Response.json({
    balance:{symbol:"AMA",flat:123456,float:0.000123456},
  });
  throw Error("No unverified pool history/reserves may be fetched");
}

test("testnet terminal has exactly two AMA pairs; no fabricated history, reserves, prices or chart",async()=>{
  await withRpc(healthy,async calls=>{
    for(const base of ["TESTBTC","TESTUSD"]){
      const r=await GET(request(base));
      assert.equal(r.status,200);
      const data=await r.json();
      assert.equal(data.network,"amadeus-testnet");
      assert.equal(data.status,"blocked");
      assert.equal(data.tradingEnabled,false);
      assert.equal(data.market.pair,base+"/AMA");
      assert.equal(data.market.pool,null);
      assert.equal(data.market.wallet,null);
      assert.equal(data.market.history,null);
      assert.equal(data.market.chart,null);
      assert.equal(data.market.token.status,"unregistered");
      assert.equal(data.market.health.rootedHeight,8999);
      assert.match(r.headers.get("cache-control")||"",/no-store/);
    }
    assert.equal(calls.some(u=>u.includes("/chain/tx")||u.includes("/contract/view")),false);
  });
});

test("valid public wallet displays actual AMA holdings but base token stays unavailable when unissued",async()=>{
  await withRpc(healthy,async calls=>{
    const r=await GET(request("TESTBTC",OWNER));
    assert.equal(r.status,200);
    const data=await r.json();
    assert.equal(data.market.wallet.amaAtomic,"123456");
    assert.equal(data.market.wallet.baseAtomic,null);
    assert.equal(data.market.wallet.baseStatus,"token_not_issued");
    assert.equal(data.market.history,null);
    assert.equal(calls.filter(x=>x.includes("/wallet/balance/")).length,1);
  });
});

test("unrecognized pair and invalid wallet fail without ANY RPC request",async()=>{
  await withRpc(()=>{throw Error("no calls");},async calls=>{
    for(const requestValue of [request("TESTETH"),request("AMA"),request("TESTUSD","0xBAD"),request("TESTBTC","")]){
      const r=await GET(requestValue);
      assert.equal(r.status,400);
      const data=await r.json();
      assert.equal(data.market,null);
      assert.equal(data.tradingEnabled,false);
    }
    assert.equal(calls.length,0);
  });
});

test("RPC unavailability never falls back or shows pretend market statistics",async()=>{
  await withRpc(()=>Response.json({error:"rpc_down"},{status:503}),async calls=>{
    const r=await GET(request("TESTBTC",OWNER));
    assert.equal(r.status,503);
    const data=await r.json();
    assert.equal(data.market,null);
    assert.equal(data.tradingEnabled,false);
    assert.ok(calls.every(x=>x.startsWith(AMA_TESTNET_RPC+"/")));
  });
});

test("disallowed mainnet config fails before any external request",async()=>{
  await withRpc(()=>{throw Error("no calls");},async calls=>{
    process.env.AMADEUS_RPC_URL="https://mainnet-rpc.ama.one/api";
    const r=await GET(request());
    assert.equal(r.status,503);
    assert.equal((await r.json()).market,null);
    assert.equal(calls.length,0);
  });
});
